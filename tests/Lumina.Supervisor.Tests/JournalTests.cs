using Lumina.Domain.Jobs;
using Lumina.Supervisor.Errors;
using Lumina.Supervisor.Recovery;
using Xunit;

namespace Lumina.Supervisor.Tests;

public class JournalTests
{
    private static string TempRoot() => Path.Combine(Path.GetTempPath(), "lumina-j-" + Guid.NewGuid().ToString("N"));

    [Fact]
    public void AtomicWriteAndRead()
    {
        var root = TempRoot();
        var store = new JobJournalStore(root);
        var j = new JobJournal { JobId = Guid.NewGuid().ToString("D"), JobKind = "Test", State = JobState.Running, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        store.WriteAtomic(j);
        store.WriteAtomic(j);
        var read = store.TryRead(j.JobId);
        Assert.NotNull(read);
        Assert.Equal(JobState.Running, read!.State);
        Assert.DoesNotContain("LUMINA_G2_SECRET_SENTINEL", File.ReadAllText(store.PathFor(j.JobId)));
    }

    [Fact]
    public void RunningBecomesInterruptedOnRecover()
    {
        var root = TempRoot();
        var store = new JobJournalStore(root);
        var j = new JobJournal { JobId = Guid.NewGuid().ToString("D"), JobKind = "Test", State = JobState.Running, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        store.WriteAtomic(j);
        var recovered = JobRecovery.Recover(store);
        Assert.Equal(JobState.Interrupted, recovered.Single().State);
    }

    [Fact]
    public void PausedBecomesInterruptedOnRecover()
    {
        var root = TempRoot();
        var store = new JobJournalStore(root);
        var j = new JobJournal { JobId = Guid.NewGuid().ToString("D"), JobKind = "Test", State = JobState.Paused, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        store.WriteAtomic(j);
        Assert.Equal(JobState.Interrupted, JobRecovery.Recover(store).Single().State);
    }

    [Theory]
    [InlineData(JobState.Succeeded)]
    [InlineData(JobState.Failed)]
    [InlineData(JobState.Cancelled)]
    [InlineData(JobState.Interrupted)]
    [InlineData(JobState.Queued)]
    public void TerminalAndQueuedPreserved(JobState state)
    {
        var root = TempRoot();
        var store = new JobJournalStore(root);
        var j = new JobJournal { JobId = Guid.NewGuid().ToString("D"), JobKind = "Test", State = state, CreatedAt = DateTimeOffset.UtcNow, UpdatedAt = DateTimeOffset.UtcNow };
        store.WriteAtomic(j);
        Assert.Equal(state, JobRecovery.Recover(store).Single().State);
    }

    [Fact]
    public void CorruptJsonFailsClosed()
    {
        var root = TempRoot();
        Directory.CreateDirectory(root);
        var path = Path.Combine(root, Guid.NewGuid().ToString("D") + ".json");
        File.WriteAllText(path, "{not json");
        var store = new JobJournalStore(root);
        Assert.Throws<SupervisorException>(() => store.ReadAll().ToList());
    }

    [Fact]
    public void TruncatedJsonFailsClosed()
    {
        var root = TempRoot();
        Directory.CreateDirectory(root);
        var path = Path.Combine(root, Guid.NewGuid().ToString("D") + ".json");
        File.WriteAllText(path, "{\"schema_version\":1,\"job_id\":");
        var store = new JobJournalStore(root);
        var ex = Assert.Throws<SupervisorException>(() => store.ReadAll().ToList());
        Assert.Equal(SupervisorErrorCode.JournalCorrupt, ex.Code);
    }

    [Fact]
    public void MissingJournalIsNull()
    {
        var store = new JobJournalStore(TempRoot());
        Assert.Null(store.TryRead(Guid.NewGuid().ToString("D")));
    }
}
