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
                    if (prop.Value.ValueKind != JsonValueKind.String)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "kind");
                    kind = prop.Value.GetString();
                    break;
                case "type":
                    if (prop.Value.ValueKind != JsonValueKind.String)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "type");
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
                    RequireEmptyOrKnown(payload, ["job_kind", "secret_required", "grant", "g2_mode", "operation", "source_path", "format_hint"]);
                    if (payload.TryGetProperty("operation", out var op))
                    {
                        if (op.ValueKind != JsonValueKind.String)
                            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "operation");
                        if (op.GetString() == "test")
                        {
                            if (!payload.TryGetProperty("source_path", out var sp) || sp.ValueKind != JsonValueKind.String || string.IsNullOrEmpty(sp.GetString()))
                                throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "source_path required");
                        }
                    }
                    if (payload.TryGetProperty("source_path", out var source) && source.ValueKind != JsonValueKind.String)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "source_path");
                    if (payload.TryGetProperty("format_hint", out var hint) && hint.ValueKind != JsonValueKind.String)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "format_hint");
                    if (payload.TryGetProperty("g2_mode", out var g2) && g2.ValueKind != JsonValueKind.String)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "g2_mode");
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
                    RequireCommandSeq(payload);
                    break;
                case "heartbeat":
                    RequireHeartbeat(payload);
                    break;
                case "progress":
                    RequireEmptyOrKnown(payload, ["entries_done", "entries_total", "bytes_done", "bytes_total", "rate_bps", "phase", "current_entry_display"]);
                    break;
                case "archive_info":
                    RequireEmptyOrKnown(payload, ["format", "item_count", "physical_size", "solid", "encrypted", "handler"]);
                    break;
                case "entry_batch":
                    RequireEmptyOrKnown(payload, ["batch_index", "first_entry_index", "entries"]);
                    if (!payload.TryGetProperty("batch_index", out var bi) || bi.ValueKind != JsonValueKind.Number)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "batch_index");
                    if (!payload.TryGetProperty("entries", out var ents) || ents.ValueKind != JsonValueKind.Array)
                        throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "entries");
                    break;
                case "completed":
                case "failed":
                    RequireEmptyOrKnown(payload, ["command_seq", "code", "message", "items_tested", "result"]);
                    if (payload.TryGetProperty("command_seq", out var termSeq))
                        RequireNonNegativeInt(termSeq, "command_seq");
                    break;
            }
        }
    }

    public static int RequireCommandSeq(JsonElement payload)
    {
        RequireEmptyOrKnown(payload, ["command_seq"]);
        if (!payload.TryGetProperty("command_seq", out var seqEl))
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "command_seq missing");
        return RequireNonNegativeInt(seqEl, "command_seq");
    }

    public static bool AckMatches(JsonElement payload, int expectedCommandSeq)
    {
        try
        {
            return RequireCommandSeq(payload) == expectedCommandSeq;
        }
        catch (SupervisorException)
        {
            return false;
        }
    }

    private static void RequireHeartbeat(JsonElement payload)
    {
        RequireEmptyOrKnown(payload, ["uptime_ms", "state"]);
        if (!payload.TryGetProperty("uptime_ms", out var up))
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "uptime_ms missing");
        RequireNonNegativeInt(up, "uptime_ms");
        if (!payload.TryGetProperty("state", out var st) || st.ValueKind != JsonValueKind.String)
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "heartbeat state");
        var s = st.GetString();
        if (s is not ("running" or "paused"))
            throw new SupervisorException(SupervisorErrorCode.EnvelopeInvalid, "heartbeat state");
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
