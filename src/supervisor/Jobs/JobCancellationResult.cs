namespace Lumina.Supervisor.Jobs;

public enum JobCancellationResult
{
    Accepted,
    AlreadyRequested,
    AlreadyTerminal,
    NotFound,
}

public enum WorkerFailureCode
{
    None,
    HeartbeatTimeout,
    WorkerCrashed,
    WorkerExitedUnexpectedly,
    ProtocolBroken,
    PipePeerMismatch,
    WorkerLaunchFailed,
    HandshakeTimeout,
    JournalCorrupt,
}
