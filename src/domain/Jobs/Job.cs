namespace Lumina.Domain.Jobs;

public enum JobKind
{
    Extract,
    Compress,
    Test,
    Hash,
    Repair
}

public enum JobState
{
    Queued,
    Running,
    Paused,
    Succeeded,
    Failed,
    Cancelled,
    Interrupted
}

public sealed record Job(
    string Id,
    JobKind Kind,
    IReadOnlyList<string> Sources,
    string Destination,
    string? Format,
    string Preset,
    int Threads,
    bool SmartExtract,
    IReadOnlyList<string> Exclude,
    DateTimeOffset CreatedAt,
    JobState State);

public static class JobStateMachine
{
    public static bool CanTransition(JobState from, JobState to) => (from, to) switch
    {
        (JobState.Queued, JobState.Running) => true,
        (JobState.Running, JobState.Paused) => true,
        (JobState.Paused, JobState.Running) => true,
        (JobState.Running, JobState.Succeeded) => true,
        (JobState.Running, JobState.Failed) => true,
        (JobState.Running, JobState.Cancelled) => true,
        (JobState.Paused, JobState.Cancelled) => true,
        (JobState.Queued, JobState.Cancelled) => true,
        (JobState.Running, JobState.Interrupted) => true,
        (JobState.Paused, JobState.Interrupted) => true,
        (JobState.Queued, JobState.Interrupted) => true,
        (JobState.Paused, JobState.Failed) => true,
        _ => false
    };
}
