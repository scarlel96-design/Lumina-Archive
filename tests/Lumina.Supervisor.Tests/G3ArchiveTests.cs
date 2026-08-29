using System.Runtime.Versioning;
using System.Text;
using Lumina.Domain.Jobs;
using Lumina.Supervisor.Jobs;
using Lumina.Supervisor.Resources;
using Lumina.Supervisor.Secrets;
using Xunit;

namespace Lumina.Supervisor.Tests;

[SupportedOSPlatform("windows")]
public class G3ArchiveTests
{
    private static readonly byte[] Sentinel = "G3_TEST_SENTINEL_PW_7z26"u8.ToArray();

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

    private static string Fixture(string name)
    {
        var roots = new[]
        {
            Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", "..", "..", "tests", "fixtures", "g3")),
            Path.GetFullPath(Path.Combine(Environment.CurrentDirectory, "tests", "fixtures", "g3")),
        };
        foreach (var r in roots)
        {
            var p = Path.Combine(r, name);
            if (File.Exists(p)) return p;
        }
        throw new FileNotFoundException(name);
    }

    private static async Task WaitState(JobSupervisor s, Guid id, JobState want, int ms = 15000)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(ms);
        JobState last = s.GetState(id);
        while (DateTime.UtcNow < deadline)
        {
            last = s.GetState(id);
            if (last == want) return;
            await Task.Delay(50);
        }
        throw new TimeoutException("state " + last);
    }

    private static void AssertNoSentinel(string journal)
    {
        if (!Directory.Exists(journal)) return;
        foreach (var f in Directory.EnumerateFiles(journal, "*", SearchOption.AllDirectories))
        {
            var t = File.ReadAllText(f);
            if (t.Contains("G3_TEST_SENTINEL", StringComparison.Ordinal))
                throw new InvalidOperationException("secret leak in journal");
        }
    }

    [Fact]
    public async Task PlainZipAnd7zTestSucceed()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath() ?? throw new InvalidOperationException("engine missing");
        if (!File.Exists(Path.Combine(Path.GetDirectoryName(engine)!, "7z.dll")))
            throw new InvalidOperationException("7z.dll not staged");
        foreach (var name in new[] { "plain.zip", "plain.7z", "unicode.zip", "empty.zip", "malicious-names.zip" })
        {
            var journal = Path.Combine(Path.GetTempPath(), "lumina-g3-" + Guid.NewGuid().ToString("N"));
            await using var supervisor = new JobSupervisor(new JobSupervisorOptions { EnginePath = engine, JournalRoot = journal });
            var id = await supervisor.StartArchiveTestAsync(Fixture(name), null, new ResourceRequest(1, 32 * 1024 * 1024, 1, 0), CancellationToken.None);
            await WaitState(supervisor, id, JobState.Succeeded);
            await supervisor.DisposeJobAsync(id);
            AssertNoSentinel(journal);
        }
    }

    [Fact]
    public async Task HeaderEncryptedCorrectAndWrongPassword()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath() ?? throw new InvalidOperationException("engine missing");
        var journal = Path.Combine(Path.GetTempPath(), "lumina-g3-enc-" + Guid.NewGuid().ToString("N"));
        await using var supervisor = new JobSupervisor(new JobSupervisorOptions { EnginePath = engine, JournalRoot = journal });
        using var secret = new SecretBuffer(Sentinel);
        var ok = await supervisor.StartArchiveTestAsync(Fixture("header-encrypted.7z"), secret, new ResourceRequest(1, 32 * 1024 * 1024, 1, 0), CancellationToken.None, "7z");
        await WaitState(supervisor, ok, JobState.Succeeded);
        await supervisor.DisposeJobAsync(ok);

        using var wrong = new SecretBuffer("not-the-fixture-password"u8);
        var bad = await supervisor.StartArchiveTestAsync(Fixture("header-encrypted.7z"), wrong, new ResourceRequest(1, 32 * 1024 * 1024, 1, 0), CancellationToken.None, "7z");
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline && supervisor.GetState(bad) is JobState.Queued or JobState.Running or JobState.Paused)
            await Task.Delay(50);
        Assert.Equal(JobState.Failed, supervisor.GetState(bad));
        await supervisor.DisposeJobAsync(bad);
        AssertNoSentinel(journal);
    }

    [Fact]
    public async Task MissingPasswordFailsStructured()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath() ?? throw new InvalidOperationException("engine missing");
        var journal = Path.Combine(Path.GetTempPath(), "lumina-g3-pw-" + Guid.NewGuid().ToString("N"));
        await using var supervisor = new JobSupervisor(new JobSupervisorOptions { EnginePath = engine, JournalRoot = journal });
        var id = await supervisor.StartArchiveTestAsync(Fixture("header-encrypted.7z"), null, new ResourceRequest(1, 32 * 1024 * 1024, 1, 0), CancellationToken.None, "7z");
        var deadline = DateTime.UtcNow.AddSeconds(15);
        while (DateTime.UtcNow < deadline && supervisor.GetState(id) is JobState.Queued or JobState.Running)
            await Task.Delay(50);
        Assert.Equal(JobState.Failed, supervisor.GetState(id));
        await supervisor.DisposeJobAsync(id);
        AssertNoSentinel(journal);
    }

    [Fact]
    public async Task CorruptAndNonArchiveFailClosed()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath() ?? throw new InvalidOperationException("engine missing");
        foreach (var name in new[] { "random.bin", "truncated.7z", "truncated.zip" })
        {
            var journal = Path.Combine(Path.GetTempPath(), "lumina-g3-bad-" + Guid.NewGuid().ToString("N"));
            await using var supervisor = new JobSupervisor(new JobSupervisorOptions { EnginePath = engine, JournalRoot = journal });
            var id = await supervisor.StartArchiveTestAsync(Fixture(name), null, new ResourceRequest(1, 16 * 1024 * 1024, 1, 0), CancellationToken.None);
            var deadline = DateTime.UtcNow.AddSeconds(15);
            while (DateTime.UtcNow < deadline && supervisor.GetState(id) is JobState.Queued or JobState.Running)
                await Task.Delay(50);
            Assert.True(supervisor.GetState(id) is JobState.Failed or JobState.Interrupted);
            await supervisor.DisposeJobAsync(id);
        }
    }

    [Fact]
    public async Task CancelManyEntriesDoesNotNeedJobObjectKill()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath() ?? throw new InvalidOperationException("engine missing");
        var journal = Path.Combine(Path.GetTempPath(), "lumina-g3-cancel-" + Guid.NewGuid().ToString("N"));
        await using var supervisor = new JobSupervisor(new JobSupervisorOptions { EnginePath = engine, JournalRoot = journal });
        var id = await supervisor.StartArchiveTestAsync(Fixture("many-entries.zip"), null, new ResourceRequest(1, 64 * 1024 * 1024, 1, 0), CancellationToken.None);
        await Task.Delay(80);
        Assert.Equal(JobCancellationResult.Accepted, supervisor.Cancel(id));
        var deadline = DateTime.UtcNow.AddSeconds(15);
        JobState last = supervisor.GetState(id);
        while (DateTime.UtcNow < deadline)
        {
            last = supervisor.GetState(id);
            if (last is JobState.Cancelled or JobState.Succeeded) break;
            await Task.Delay(40);
        }
        Assert.True(last is JobState.Cancelled or JobState.Succeeded);
        await supervisor.DisposeJobAsync(id);
    }

    [Fact]
    public async Task LargeListBatches()
    {
        if (!OperatingSystem.IsWindows()) return;
        var engine = EnginePath() ?? throw new InvalidOperationException("engine missing");
        var journal = Path.Combine(Path.GetTempPath(), "lumina-g3-list-" + Guid.NewGuid().ToString("N"));
        await using var supervisor = new JobSupervisor(new JobSupervisorOptions { EnginePath = engine, JournalRoot = journal });
        var id = await supervisor.StartArchiveTestAsync(Fixture("many-entries.zip"), null, new ResourceRequest(1, 64 * 1024 * 1024, 1, 0), CancellationToken.None);
        await WaitState(supervisor, id, JobState.Succeeded, 60000);
        await supervisor.DisposeJobAsync(id);
    }
}
