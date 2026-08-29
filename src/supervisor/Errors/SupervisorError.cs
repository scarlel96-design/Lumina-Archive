namespace Lumina.Supervisor.Errors;

public enum SupervisorErrorCode
{
    ProtocolVersionUnsupported,
    FrameTooLarge,
    MalformedFrame,
    InvalidUtf8,
    InvalidJson,
    EnvelopeInvalid,
    SequenceViolation,
    JobIdMismatch,
    PipePeerMismatch,
    SecretFrameInvalid,
    WorkerLaunchFailed,
    JobObjectCreateFailed,
    JobObjectAssignFailed,
    WorkerResumeFailed,
    WorkerExitedUnexpectedly,
    HeartbeatTimeout,
    JournalCorrupt,
    ResourceRequestTooLarge,
    HandshakeTimeout,
    PlatformUnsupported,
}

public sealed class SupervisorException : Exception
{
    public SupervisorErrorCode Code { get; }

    public SupervisorException(SupervisorErrorCode code, string message, Exception? inner = null)
        : base(message, inner)
    {
        Code = code;
    }
}
