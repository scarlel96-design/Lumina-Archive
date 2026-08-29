namespace Lumina.Supervisor.Ipc;

public static class ProtocolConstants
{
    public const int ProtocolVersion = 1;
    public const int MaxControlFrameBytes = 1 * 1024 * 1024;
    public const int MaxSecretBytes = 64 * 1024;
    public const string PipeNamespace = "LuminaArchive.v1";
    public static readonly TimeSpan HeartbeatInterval = TimeSpan.FromSeconds(1);
    public static readonly TimeSpan HeartbeatStale = TimeSpan.FromSeconds(5);
    public static readonly TimeSpan ShutdownGrace = TimeSpan.FromSeconds(2);
    public static readonly TimeSpan HandshakeTimeout = TimeSpan.FromSeconds(10);

    public static readonly HashSet<string> Commands = new(StringComparer.Ordinal)
    {
        "start", "pause", "resume", "cancel", "shutdown"
    };

    public static readonly HashSet<string> Events = new(StringComparer.Ordinal)
    {
        "accepted", "progress", "heartbeat", "paused", "resumed", "completed", "failed", "cancelled", "archive_info", "entry_batch"
    };

    public static string ControlPipeName(Guid jobId) => $"{PipeNamespace}.{jobId:D}.control";
    public static string SecretPipeName(Guid jobId) => $"{PipeNamespace}.{jobId:D}.secret";
    public static string WindowsPipePath(string name) => @"\\.\pipe\" + name;
}
