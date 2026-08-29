using Lumina.Domain.Jobs;
using Lumina.Supervisor.Jobs;
using Lumina.Supervisor.Resources;
using Lumina.Supervisor.Secrets;

namespace Lumina.Cli;

internal static class Program
{
    private static async Task<int> Main(string[] args)
    {
        if (args is ["--bench-identity"])
        {
            Console.WriteLine("{\"product\":\"Lumina Archive\",\"version\":\"0.0.0-g2\",\"engine\":\"not-linked\",\"phase\":\"G2\"}");
            return 0;
        }

        if (args is ["--constitution"])
        {
            Console.WriteLine("Lumina.Cli G2");
            Console.WriteLine("JobStateMachine.CanTransition(Queued, Running)=" +
                JobStateMachine.CanTransition(JobState.Queued, JobState.Running));
            return 0;
        }

        if (args.Length > 0 && (args[0] == "--g2-self-test" || (args.Length >= 2 && args[0] == "doctor" && args[1] == "ipc")))
        {
            return await G2SelfTestAsync();
        }

        Console.Error.WriteLine("G2: archive commands are not implemented. Use --g2-self-test for protocol diagnostics.");
        return 2;
    }

    [System.Runtime.Versioning.SupportedOSPlatform("windows")]
    private static async Task<int> G2SelfTestAsync()
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.Error.WriteLine("G2 protocol test BLOCKED BY ENVIRONMENT (Windows required)");
            return 3;
        }

        var engine = Environment.GetEnvironmentVariable("LUMINA_ENGINE")
            ?? FindEngine();
        if (engine is null || !File.Exists(engine))
        {
            Console.Error.WriteLine("G2 protocol test: lumina-engine.exe not found");
            return 4;
        }

        var journal = Path.Combine(Path.GetTempPath(), "lumina-g2-journal-" + Guid.NewGuid().ToString("N"));
        await using var supervisor = new JobSupervisor(new JobSupervisorOptions
        {
            EnginePath = engine,
            JournalRoot = journal,
        });

        using var secret = new SecretBuffer("LUMINA_G2_SECRET_SENTINEL_PROTOCOL"u8);
        var id = await supervisor.StartProtocolSelfTestAsync(secret, new ResourceRequest(1, 32 * 1024 * 1024, 1, 0), CancellationToken.None);
        await supervisor.PauseAsync(id);
        await Task.Delay(200);
        await supervisor.ResumeAsync(id);
        await Task.Delay(200);
        var cancel = supervisor.Cancel(id);
        await Task.Delay(400);
        await supervisor.DisposeJobAsync(id);
        Console.WriteLine("G2 protocol test");
        Console.WriteLine("job=" + id.ToString("D"));
        Console.WriteLine("cancel=" + cancel);
        Console.WriteLine("state=" + supervisor.GetState(id));
        Console.WriteLine("not archive operation completed");
        return 0;
    }

    private static string? FindEngine()
    {
        var here = AppContext.BaseDirectory;
        string[] guesses =
        [
            Path.Combine(here, "lumina-engine.exe"),
            Path.GetFullPath(Path.Combine(here, "..", "..", "..", "..", "build", "win-x64-release", "native", "engine", "Release", "lumina-engine.exe")),
        ];
        return guesses.FirstOrDefault(File.Exists);
    }
}
