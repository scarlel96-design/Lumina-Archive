using Lumina.Domain.Jobs;

namespace Lumina.Supervisor.Jobs;

public enum InternalJobPhase
{
    Starting,
    Running,
    PausePending,
    Paused,
    ResumePending,
    CancelPending,
    Terminal,
}

public sealed class JobRuntimeSnapshot
{
    public required string JobId { get; init; }
    public required JobState PublicState { get; init; }
    public required InternalJobPhase Phase { get; init; }
    public WorkerFailureCode Failure { get; init; }
    public int? WorkerPid { get; init; }
}
