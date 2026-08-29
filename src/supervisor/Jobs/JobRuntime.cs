using System.Runtime.Versioning;
using System.Text.Json;
using Lumina.Domain.Jobs;
using Lumina.Supervisor.Errors;
using Lumina.Supervisor.Ipc;
using Lumina.Supervisor.Process;
using Lumina.Supervisor.Recovery;
using Lumina.Supervisor.Resources;
using Lumina.Supervisor.Secrets;

namespace Lumina.Supervisor.Jobs;

[SupportedOSPlatform("windows")]
internal sealed class JobRuntime : IAsyncDisposable
{
    private readonly object _gate = new();
    private readonly JobJournalStore _store;
    private readonly TimeProvider _clock;
    private readonly string _enginePath;
    private ControlPipeServer? _control;
    private SecretPipeServer? _secretPipe;
    private LaunchedWorker? _worker;
    private ResourceLease? _lease;
    private CancellationTokenSource _cts = new();
    private Task? _loop;
    private int _nextCommandSeq;
    private int _nextEventSeq;
    private InternalJobPhase _phase = InternalJobPhase.Starting;
    private JobState _public = JobState.Queued;
    private WorkerFailureCode _failure = WorkerFailureCode.None;
    private DateTimeOffset _lastHeartbeat;
    private bool _cancelRequested;
    private bool _terminalCommitted;
    private readonly SemaphoreSlim _writeLock = new(1, 1);
    private TaskCompletionSource<bool> _accepted = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public JobRuntime(Guid jobId, JobKind kind, ResourceLease lease, JobJournalStore store, TimeProvider clock, string enginePath)
    {
        JobId = jobId;
        Kind = kind;
        _lease = lease;
        _store = store;
        _clock = clock;
        _enginePath = enginePath;
        _lastHeartbeat = clock.GetUtcNow();
        Journal = new JobJournal
        {
            JobId = jobId.ToString("D"),
            JobKind = kind.ToString(),
            State = JobState.Queued,
            CreatedAt = clock.GetUtcNow(),
            UpdatedAt = clock.GetUtcNow(),
        };
        Persist();
    }

    public Guid JobId { get; }
    public JobKind Kind { get; }
    public JobJournal Journal { get; }
    public JobState PublicState { get { lock (_gate) return _public; } }
    public int? WorkerPid => _worker?.Pid;

    public JobRuntimeSnapshot Snapshot()
    {
        lock (_gate)
        {
            return new JobRuntimeSnapshot
            {
                JobId = JobId.ToString("D"),
                PublicState = _public,
                Phase = _phase,
                Failure = _failure,
                WorkerPid = _worker?.Pid,
            };
        }
    }

    public async Task StartAsync(SecretBuffer? secret, CancellationToken ct)
    {
        if (!OperatingSystem.IsWindows())
            throw new SupervisorException(SupervisorErrorCode.PlatformUnsupported, "G2 worker requires Windows");

        var controlName = ProtocolConstants.ControlPipeName(JobId);
        var secretName = ProtocolConstants.SecretPipeName(JobId);
        _control = new ControlPipeServer(controlName);
        _secretPipe = new SecretPipeServer(secretName);
        _worker = EngineProcessLauncher.LaunchSuspended(
            _enginePath,
            JobId,
            ProtocolConstants.WindowsPipePath(controlName),
            ProtocolConstants.WindowsPipePath(secretName));

        using var handshake = CancellationTokenSource.CreateLinkedTokenSource(ct, _cts.Token);
        handshake.CancelAfter(ProtocolConstants.HandshakeTimeout);
        try
        {
            await _control.WaitForClientAsync((uint)_worker.Pid, handshake.Token).ConfigureAwait(false);
            var startPayload = JsonSerializer.SerializeToElement(new Dictionary<string, object?>
            {
                ["job_kind"] = Kind.ToString(),
                ["secret_required"] = secret is { Length: > 0 },
                ["g2_mode"] = "protocol-self-test",
                ["grant"] = new Dictionary<string, object?>
                {
                    ["cpu_threads"] = _lease!.Grant.CpuThreads,
                    ["memory_bytes"] = _lease.Grant.MemoryBytes,
                    ["io_slots"] = _lease.Grant.IoSlots,
                    ["preview_slots"] = _lease.Grant.PreviewSlots,
                },
            });
            var start = new IpcEnvelope(ProtocolConstants.ProtocolVersion, JobId.ToString("D"), NextCommandSeq(), "command", "start", startPayload);
            await WriteEnvelopeAsync(start, handshake.Token).ConfigureAwait(false);

            if (secret is { Length: > 0 })
            {
                await _secretPipe.WaitForClientAsync((uint)_worker.Pid, handshake.Token).ConfigureAwait(false);
                var copy = secret.Span.ToArray();
                try
                {
                    await PipeFramer.WriteSecretAsync(_secretPipe.Stream, copy, handshake.Token).ConfigureAwait(false);
                }
                finally
                {
                    System.Security.Cryptography.CryptographicOperations.ZeroMemory(copy);
                }
                _secretPipe.Dispose();
                _secretPipe = null;
            }

            lock (_gate) _lastHeartbeat = _clock.GetUtcNow();
            _loop = Task.Run(() => ReadLoopAsync(_cts.Token));
            await _accepted.Task.WaitAsync(handshake.Token).ConfigureAwait(false);
            _ = Task.Run(() => WatchdogAsync(_cts.Token));
        }
        catch (SupervisorException)
        {
            FailInfrastructure(WorkerFailureCode.WorkerLaunchFailed);
            _worker?.Job.TryTerminate(1, out _);
            throw;
        }
        catch (Exception ex)
        {
            FailInfrastructure(WorkerFailureCode.HandshakeTimeout);
            _worker?.Job.TryTerminate(1, out _);
            throw new SupervisorException(SupervisorErrorCode.HandshakeTimeout, "handshake failed", ex);
        }
    }

    public JobCancellationResult RequestCancel()
    {
        lock (_gate)
        {
            if (_terminalCommitted)
                return JobCancellationResult.AlreadyTerminal;
            if (_cancelRequested)
                return JobCancellationResult.AlreadyRequested;
            _cancelRequested = true;
            _phase = InternalJobPhase.CancelPending;
            Journal.CancelRequested = true;
        }
        Persist();
        _ = SendCommandAsync("cancel", JsonSerializer.SerializeToElement(new Dictionary<string, string>()));
        return JobCancellationResult.Accepted;
    }

    public Task PauseAsync() => SendCommandAsync("pause", JsonSerializer.SerializeToElement(new Dictionary<string, string>()));
    public Task ResumeAsync() => SendCommandAsync("resume", JsonSerializer.SerializeToElement(new Dictionary<string, string>()));
    public Task ShutdownAsync() => SendCommandAsync("shutdown", JsonSerializer.SerializeToElement(new Dictionary<string, string>()));

    public async ValueTask DisposeAsync()
    {
        _cts.Cancel();
        try
        {
            if (_loop is not null) await _loop.WaitAsync(ProtocolConstants.ShutdownGrace);
        }
        catch { /* swallow on dispose */ }
        _worker?.Job.TryTerminate(1, out _);
        _control?.Dispose();
        _secretPipe?.Dispose();
        _worker?.Dispose();
        _lease?.Dispose();
        _lease = null;
        _writeLock.Dispose();
        _cts.Dispose();
    }

    private async Task ReadLoopAsync(CancellationToken ct)
    {
        try
        {
            while (!ct.IsCancellationRequested && _control is not null)
            {
                var env = await PipeFramer.ReadEnvelopeAsync(_control.Stream, ct).ConfigureAwait(false);
                HandleEvent(env);
            }
        }
        catch (OperationCanceledException) { }
        catch
        {
            FailInfrastructure(WorkerFailureCode.ProtocolBroken);
        }
        finally
        {
            ObserveProcessExit();
        }
    }

    private async Task WatchdogAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(ProtocolConstants.HeartbeatInterval, _clock, ct).ConfigureAwait(false);
            }
            catch (OperationCanceledException) { return; }
            DateTimeOffset last;
            bool terminal;
            lock (_gate)
            {
                last = _lastHeartbeat;
                terminal = _terminalCommitted;
            }
            if (terminal) return;
            if (_clock.GetUtcNow() - last > ProtocolConstants.HeartbeatStale)
            {
                try
                {
                    await SendCommandAsync("shutdown", JsonSerializer.SerializeToElement(new Dictionary<string, string>()));
                    await Task.Delay(ProtocolConstants.ShutdownGrace, _clock, ct).ConfigureAwait(false);
                }
                catch (OperationCanceledException) { return; }
                catch { /* still terminate */ }
                FailInfrastructure(WorkerFailureCode.HeartbeatTimeout);
                _worker?.Job.TryTerminate(1, out _);
                return;
            }
        }
    }

    private void HandleEvent(IpcEnvelope env)
    {
        ProtocolValidator.ValidateDirection(env, "event");
        ProtocolValidator.ValidateJobId(env, JobId.ToString("D"));
        lock (_gate)
        {
            ProtocolValidator.ValidateContiguous(_nextEventSeq, env.Seq);
            _nextEventSeq++;
            Journal.LastEventSeq = env.Seq;
            if (env.Type == "heartbeat")
                _lastHeartbeat = _clock.GetUtcNow();
            if (_terminalCommitted)
                return;
            switch (env.Type)
            {
                case "accepted":
                    _public = JobState.Running;
                    _phase = InternalJobPhase.Running;
                    Journal.State = JobState.Running;
                    _accepted.TrySetResult(true);
                    break;
                case "paused":
                    _public = JobState.Paused;
                    _phase = InternalJobPhase.Paused;
                    Journal.State = JobState.Paused;
                    break;
                case "resumed":
                    _public = JobState.Running;
                    _phase = InternalJobPhase.Running;
                    Journal.State = JobState.Running;
                    break;
                case "completed":
                    CommitTerminalUnlocked(JobState.Succeeded, WorkerFailureCode.None);
                    break;
                case "failed":
                    CommitTerminalUnlocked(JobState.Failed, WorkerFailureCode.None);
                    break;
                case "cancelled":
                    CommitTerminalUnlocked(JobState.Cancelled, WorkerFailureCode.None);
                    break;
                case "heartbeat":
                case "progress":
                    break;
            }
        }
        if (env.Type is not ("heartbeat" or "progress"))
            Persist();
    }

    private void FailInfrastructure(WorkerFailureCode code)
    {
        lock (_gate)
        {
            if (_terminalCommitted) return;
            CommitTerminalUnlocked(JobState.Interrupted, code);
        }
        Persist();
    }

    private void ObserveProcessExit()
    {
        var code = _worker?.TryGetExitCode();
        if (code is null) return;
        lock (_gate)
        {
            if (_terminalCommitted) return;
            CommitTerminalUnlocked(JobState.Interrupted, WorkerFailureCode.WorkerExitedUnexpectedly);
        }
        Persist();
    }

    private void CommitTerminalUnlocked(JobState state, WorkerFailureCode failure)
    {
        _terminalCommitted = true;
        _public = state;
        _phase = InternalJobPhase.Terminal;
        _failure = failure;
        Journal.State = state;
        Journal.FailureCode = failure == WorkerFailureCode.None ? null : failure.ToString();
        Journal.UpdatedAt = _clock.GetUtcNow();
    }

    private int NextCommandSeq()
    {
        var seq = _nextCommandSeq++;
        Journal.LastCommandSeq = seq;
        return seq;
    }

    private async Task SendCommandAsync(string type, JsonElement payload)
    {
        IpcEnvelope env;
        lock (_gate)
        {
            if (_terminalCommitted || _control is null) return;
            if (type == "pause") _phase = InternalJobPhase.PausePending;
            if (type == "resume") _phase = InternalJobPhase.ResumePending;
            env = new IpcEnvelope(ProtocolConstants.ProtocolVersion, JobId.ToString("D"), NextCommandSeq(), "command", type, payload);
        }
        await WriteEnvelopeAsync(env, _cts.Token).ConfigureAwait(false);
        Persist();
    }

    private async Task WriteEnvelopeAsync(IpcEnvelope env, CancellationToken ct)
    {
        if (_control is null) return;
        await _writeLock.WaitAsync(ct).ConfigureAwait(false);
        try
        {
            await PipeFramer.WriteEnvelopeAsync(_control.Stream, env, ct).ConfigureAwait(false);
        }
        finally
        {
            _writeLock.Release();
        }
    }

    private void SetPublic(JobState state, InternalJobPhase phase, bool persist)
    {
        lock (_gate)
        {
            if (_terminalCommitted) return;
            _public = state;
            _phase = phase;
            Journal.State = state;
            Journal.UpdatedAt = _clock.GetUtcNow();
        }
        if (persist) Persist();
    }

    private void Persist()
    {
        lock (_gate)
        {
            Journal.UpdatedAt = _clock.GetUtcNow();
            Journal.State = _public;
        }
        _store.WriteAtomic(Journal);
    }
}
