using System.Text.Json;
using System.Text.Json.Serialization;
using Lumina.Domain.Jobs;

namespace Lumina.Supervisor.Recovery;

public sealed class JobJournal
{
    [JsonPropertyName("schema_version")] public int SchemaVersion { get; set; } = 1;
    [JsonPropertyName("job_id")] public string JobId { get; set; } = "";
    [JsonPropertyName("job_kind")] public string JobKind { get; set; } = "";
    [JsonPropertyName("state")] public JobState State { get; set; }
    [JsonPropertyName("created_at")] public DateTimeOffset CreatedAt { get; set; }
    [JsonPropertyName("updated_at")] public DateTimeOffset UpdatedAt { get; set; }
    [JsonPropertyName("last_command_seq")] public int LastCommandSeq { get; set; } = -1;
    [JsonPropertyName("last_event_seq")] public int LastEventSeq { get; set; } = -1;
    [JsonPropertyName("failure_code")] public string? FailureCode { get; set; }
    [JsonPropertyName("cancel_requested")] public bool CancelRequested { get; set; }
    [JsonPropertyName("forced_termination")] public bool ForcedTermination { get; set; }
    [JsonPropertyName("protocol_version")] public int ProtocolVersion { get; set; } = 1;
}
