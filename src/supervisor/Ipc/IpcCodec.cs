using System.Text;
using System.Text.Json;
using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Ipc;

public sealed record IpcEnvelope(int ProtocolVersion, string JobId, int Seq, string Kind, string Type, JsonElement Payload);

public static class IpcCodec
{
    public static readonly UTF8Encoding StrictUtf8 = new(encoderShouldEmitUTF8Identifier: false, throwOnInvalidBytes: true);

    public static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        AllowTrailingCommas = false,
        ReadCommentHandling = JsonCommentHandling.Disallow,
        MaxDepth = 8,
    };

    public static byte[] EncodeUtf8(IpcEnvelope envelope)
    {
        using var stream = new MemoryStream();
        using (var writer = new Utf8JsonWriter(stream))
        {
            writer.WriteStartObject();
            writer.WriteNumber("protocol_version", envelope.ProtocolVersion);
            writer.WriteString("job_id", envelope.JobId);
            writer.WriteNumber("seq", envelope.Seq);
            writer.WriteString("kind", envelope.Kind);
            writer.WriteString("type", envelope.Type);
            writer.WritePropertyName("payload");
            envelope.Payload.WriteTo(writer);
            writer.WriteEndObject();
        }
        return stream.ToArray();
    }

    public static IpcEnvelope DecodeUtf8(ReadOnlySpan<byte> utf8)
    {
        string text;
        try
        {
            text = StrictUtf8.GetString(utf8);
        }
        catch (DecoderFallbackException ex)
        {
            throw new SupervisorException(SupervisorErrorCode.InvalidUtf8, "malformed UTF-8", ex);
        }

        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(text, new JsonDocumentOptions
            {
                AllowTrailingCommas = false,
                CommentHandling = JsonCommentHandling.Disallow,
                MaxDepth = 8,
            });
        }
        catch (JsonException ex)
        {
            throw new SupervisorException(SupervisorErrorCode.InvalidJson, "malformed JSON", ex);
        }

        using (doc)
        {
            return ProtocolValidator.ParseEnvelope(doc.RootElement);
        }
    }
}
