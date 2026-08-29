using System.Runtime.Versioning;
using Lumina.Domain.Jobs;
using Lumina.Supervisor.Ipc;
using Lumina.Supervisor.Jobs;
using Lumina.Supervisor.Process;
using Lumina.Supervisor.Resources;
using Lumina.Supervisor.Secrets;
using Xunit;

namespace Lumina.Supervisor.Tests;

[SupportedOSPlatform("windows")]
public class WindowsIntegrationTests
{
    private static string? EnginePath()
    {
        var env = Environment.GetEnvironmentVariable("LUMINA_ENGINE");
        if (!string.IsNullOrWhiteSpace(env) && File.Exists(env)) return env;
        var guesses = new[]
        {
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "build", "win-x64-release", "native", "engine", "Release", "lumina-engine.exe")),
            Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, "build", "win-x64-release", "native", "engine", "Release", "lumina-engine.exe")),
        };
        return guesses.FirstOrDefault(File.Exists);
    }

    [Fact]
    public async Task SupervisorLaunchesEnginePauseResumeSecretCancel()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath();
        if (engine is null) throw new InvalidOperationException("lumina-engine.exe missing; Windows integration not skipped");
        var journal = Path.Combine(Path.GetTempPath(), "lumina-g2-it-" + Guid.NewGuid().ToString("N"));
        await using var supervisor = new JobSupervisor(new JobSupervisorOptions { EnginePath = engine, JournalRoot = journal });
        using var secret = new SecretBuffer("LUMINA_G2_SECRET_SENTINEL_E2E"u8);
        var id = await supervisor.StartProtocolSelfTestAsync(secret, new ResourceRequest(1, 16 * 1024 * 1024, 1, 0), CancellationToken.None);
        Assert.NotNull(supervisor.GetPid(id));
        Assert.Equal(JobState.Running, supervisor.GetState(id));
        await supervisor.PauseAsync(id);
        await Task.Delay(400);
        await supervisor.ResumeAsync(id);
        await Task.Delay(200);
        Assert.Equal(JobCancellationResult.Accepted, supervisor.Cancel(id));
        Assert.Equal(JobCancellationResult.AlreadyRequested, supervisor.Cancel(id));
        await Task.Delay(800);
        await supervisor.DisposeJobAsync(id);
        var dump = Directory.EnumerateFiles(journal, "*", SearchOption.AllDirectories).Select(File.ReadAllText);
        foreach (var text in dump)
            Assert.DoesNotContain("LUMINA_G2_SECRET_SENTINEL", text);
    }

    [Fact]
    public void JobObjectKillOnCloseEndsWorker()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath();
        if (engine is null) throw new InvalidOperationException("lumina-engine.exe missing");
        var jobId = Guid.NewGuid();
        var control = Lumina.Supervisor.Ipc.ProtocolConstants.ControlPipeName(jobId);
        var secret = Lumina.Supervisor.Ipc.ProtocolConstants.SecretPipeName(jobId);
        using var controlPipe = new Lumina.Supervisor.Ipc.ControlPipeServer(control);
        using var secretPipe = new Lumina.Supervisor.Ipc.SecretPipeServer(secret);
        var worker = EngineProcessLauncher.LaunchSuspended(
            engine,
            jobId,
            Lumina.Supervisor.Ipc.ProtocolConstants.WindowsPipePath(control),
            Lumina.Supervisor.Ipc.ProtocolConstants.WindowsPipePath(secret));
        var pid = worker.Pid;
        worker.Dispose(); // closes job object -> KILL_ON_JOB_CLOSE
        var deadline = DateTime.UtcNow.AddSeconds(5);
        while (DateTime.UtcNow < deadline)
        {
            try
            {
                System.Diagnostics.Process.GetProcessById(pid);
                Thread.Sleep(50);
            }
            catch (ArgumentException)
            {
                return;
            }
        }
        throw new InvalidOperationException("worker still alive after job dispose");
    }
}
