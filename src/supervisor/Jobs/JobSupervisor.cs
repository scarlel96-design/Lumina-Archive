using System.Runtime.Versioning;
using Lumina.Domain.Jobs;
using Lumina.Supervisor.Errors;
using Lumina.Supervisor.Recovery;
using Lumina.Supervisor.Resources;
using Lumina.Supervisor.Secrets;

namespace Lumina.Supervisor.Jobs;

public sealed class JobSupervisorOptions
{
    public required string EnginePath { get; init; }
    public required string JournalRoot { get; init; }
    public ResourceGovernor? Governor { get; init; }
    public TimeProvider? TimeProvider { get; init; }
}

[SupportedOSPlatform("windows")]
public sealed class JobSupervisor : IAsyncDisposable
{
    private readonly JobSupervisorOptions _options;
    private readonly ResourceGovernor _governor;
    private readonly JobJournalStore _store;
    private readonly TimeProvider _clock;
    private readonly Dictionary<string, JobRuntime> _jobs = new(StringComparer.Ordinal);
    private readonly object _gate = new();

    public JobSupervisor(JobSupervisorOptions options)
    {
        _options = options;
        _governor = options.Governor ?? new ResourceGovernor();
        _store = new JobJournalStore(options.JournalRoot);
        _clock = options.TimeProvider ?? TimeProvider.System;
        Recovered = JobRecovery.Recover(_store);
    }

    public IReadOnlyList<JobJournal> Recovered { get; }

    public async Task<Guid> StartProtocolSelfTestAsync(SecretBuffer? secret, ResourceRequest? request, CancellationToken ct)
    {
        var jobId = Guid.NewGuid();
        var req = request ?? new ResourceRequest(1, 64L * 1024 * 1024, 1, 0);
        var lease = await _governor.AcquireAsync(req, ct).ConfigureAwait(false);
        var runtime = new JobRuntime(jobId, JobKind.Test, lease, _store, _clock, _options.EnginePath);
        lock (_gate) _jobs[jobId.ToString("D")] = runtime;
        try
        {
            await runtime.StartAsync(secret, ct).ConfigureAwait(false);
            return jobId;
        }
        catch
        {
            await runtime.DisposeAsync().ConfigureAwait(false);
            lock (_gate) _jobs.Remove(jobId.ToString("D"));
            throw;
        }
    }

    public JobState GetState(Guid jobId)
    {
        lock (_gate)
        {
            if (_jobs.TryGetValue(jobId.ToString("D"), out var rt))
                return rt.PublicState;
        }
        var journal = _store.TryRead(jobId.ToString("D"));
        return journal?.State ?? throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "job not found");
    }

    public int? GetPid(Guid jobId)
    {
        lock (_gate)
        {
            return _jobs.TryGetValue(jobId.ToString("D"), out var rt) ? rt.WorkerPid : null;
        }
    }

    public JobCancellationResult Cancel(Guid jobId)
    {
        lock (_gate)
        {
            if (!_jobs.TryGetValue(jobId.ToString("D"), out var rt))
                return JobCancellationResult.NotFound;
            return rt.RequestCancel();
        }
    }

    public Task PauseAsync(Guid jobId) => Require(jobId).PauseAsync();
    public Task ResumeAsync(Guid jobId) => Require(jobId).ResumeAsync();
    public Task ShutdownAsync(Guid jobId) => Require(jobId).ShutdownAsync();

    public async Task DisposeJobAsync(Guid jobId)
    {
        JobRuntime? rt;
        lock (_gate) _jobs.TryGetValue(jobId.ToString("D"), out rt);
        if (rt is not null) await rt.DisposeAsync().ConfigureAwait(false);
        lock (_gate) _jobs.Remove(jobId.ToString("D"));
    }

    public async ValueTask DisposeAsync()
    {
        JobRuntime[] copy;
        lock (_gate) copy = _jobs.Values.ToArray();
        foreach (var rt in copy) await rt.DisposeAsync().ConfigureAwait(false);
        lock (_gate) _jobs.Clear();
    }

    private JobRuntime Require(Guid jobId)
    {
        lock (_gate)
        {
            if (_jobs.TryGetValue(jobId.ToString("D"), out var rt)) return rt;
        }
        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "job not found");
    }
}
