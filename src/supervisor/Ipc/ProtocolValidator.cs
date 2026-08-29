using System.Text.Json;
using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Ipc;

public static class ProtocolValidator
{
    public static IpcEnvelope ParseEnvelope(JsonElement root)
    {
        if (root.ValueKind != JsonValueKind.Object)
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "root must be object");

        int? version = null;
        string? jobId = null;
        int? seq = null;
        string? kind = null;
        string? type = null;
        JsonElement? payload = null;

        foreach (var prop in root.EnumerateObject())
        {
            switch (prop.Name)
            {
                case "protocol_version":
                    version = RequireNonNegativeInt(prop.Value, "protocol_version");
                    break;
                case "job_id":
                    if (prop.Value.ValueKind != JsonValueKind.String)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "job_id");
                    jobId = prop.Value.GetString();
                    break;
                case "seq":
                    seq = RequireNonNegativeInt(prop.Value, "seq");
                    break;
                case "kind":
                    kind = prop.Value.GetString();
                    break;
                case "type":
                    type = prop.Value.GetString();
                    break;
                case "payload":
                    if (prop.Value.ValueKind != JsonValueKind.Object)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "payload must be object");
                    payload = prop.Value.Clone();
                    break;
                default:
                    throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "forbidden field " + prop.Name);
            }
        }

        if (version is null || jobId is null || seq is null || kind is null || type is null || payload is null)
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "required field missing");
        if (string.IsNullOrWhiteSpace(jobId))
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "empty job_id");
        if (version != ProtocolConstants.ProtocolVersion)
            throw new SupervisorException(SupervisorErrorCode.ProtocolVersionUnsupported, "protocol_version");
        if (kind is not ("command" or "event"))
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "kind");
        if (kind == "command" && !ProtocolConstants.Commands.Contains(type))
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "unknown command");
        if (kind == "event" && !ProtocolConstants.Events.Contains(type))
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "unknown event");
        ValidatePayload(kind, type, payload.Value);
        return new IpcEnvelope(version.Value, jobId, seq.Value, kind, type, payload.Value);
    }

    public static void ValidateDirection(IpcEnvelope envelope, string expectedKind)
    {
        if (envelope.Kind != expectedKind)
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "wrong direction");
    }

    public static void ValidateJobId(IpcEnvelope envelope, string expectedJobId)
    {
        if (!string.Equals(envelope.JobId, expectedJobId, StringComparison.Ordinal))
            throw new SupervisorException(SupervisorErrorCode.JobIdMismatch, "job_id");
    }

    public static int NextSeq(int previous) => previous + 1;

    public static void ValidateContiguous(int expected, int actual)
    {
        if (actual != expected)
            throw new SupervisorException(SupervisorErrorCode.SequenceViolation, "seq");
    }

    public static void ValidatePayload(string kind, string type, JsonElement payload)
    {
        if (payload.ValueKind != JsonValueKind.Object)
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "payload");
        if (kind == "command")
        {
            switch (type)
            {
                case "pause":
                case "resume":
                case "shutdown":
                    RequireEmptyOrKnown(payload, []);
                    break;
                case "cancel":
                    RequireEmptyOrKnown(payload, ["reason"]);
                    break;
                case "start":
                    RequireEmptyOrKnown(payload, ["job_kind", "secret_required", "grant", "g2_mode"]);
                    break;
            }
        }
        else
        {
            switch (type)
            {
                case "accepted":
                case "paused":
                case "resumed":
                case "cancelled":
                    RequireEmptyOrKnown(payload, ["command_seq"]);
                    break;
                case "heartbeat":
                    RequireEmptyOrKnown(payload, ["uptime_ms", "state"]);
                    break;
                case "progress":
                    RequireEmptyOrKnown(payload, ["entries_done", "entries_total", "bytes_done", "bytes_total", "rate_bps", "phase", "current_entry_display"]);
                    break;
                case "completed":
                case "failed":
                    RequireEmptyOrKnown(payload, ["command_seq", "code", "message"]);
                    break;
            }
        }
    }

    private static void RequireEmptyOrKnown(JsonElement payload, string[] allowed)
    {
        foreach (var prop in payload.EnumerateObject())
        {
            if (Array.IndexOf(allowed, prop.Name) < 0)
                throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "payload field " + prop.Name);
        }
    }

    private static int RequireNonNegativeInt(JsonElement value, string name)
    {
        if (value.ValueKind != JsonValueKind.Number || !value.TryGetInt32(out var n) || n < 0)
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, name);
        return n;
    }
}
