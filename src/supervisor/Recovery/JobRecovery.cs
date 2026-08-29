using Lumina.Domain.Jobs;

namespace Lumina.Supervisor.Recovery;

public static class JobRecovery
{
    public static JobState MapOnRestart(JobState state) => state switch
    {
        JobState.Running => JobState.Interrupted,
        JobState.Paused => JobState.Interrupted,
        _ => state,
    };

    public static IReadOnlyList<JobJournal> Recover(JobJournalStore store)
    {
        var result = new List<JobJournal>();
        foreach (var journal in store.ReadAll())
        {
            var mapped = MapOnRestart(journal.State);
            if (mapped != journal.State)
            {
                journal.State = mapped;
                journal.FailureCode = "RecoveredInterrupted";
                journal.UpdatedAt = DateTimeOffset.UtcNow;
                store.WriteAtomic(journal);
            }
            result.Add(journal);
        }
        return result;
    }
}
