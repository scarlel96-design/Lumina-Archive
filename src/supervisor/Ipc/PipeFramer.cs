using System.IO.Pipes;
using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Ipc;

public static class PipeFramer
{
    public static async Task WriteEnvelopeAsync(Stream stream, IpcEnvelope envelope, CancellationToken ct)
    {
        var json = IpcCodec.EncodeUtf8(envelope);
        var frame = IpcFrame.Encode(json);
        await stream.WriteAsync(frame, ct).ConfigureAwait(false);
        await stream.FlushAsync(ct).ConfigureAwait(false);
    }

    public static async Task<IpcEnvelope> ReadEnvelopeAsync(Stream stream, CancellationToken ct)
    {
        var header = new byte[4];
        await ReadExactAsync(stream, header, ct).ConfigureAwait(false);
        var length = IpcFrame.DecodeLength(header);
        var body = new byte[length];
        await ReadExactAsync(stream, body, ct).ConfigureAwait(false);
        return IpcCodec.DecodeUtf8(body);
    }

    public static async Task WriteSecretAsync(Stream stream, ReadOnlyMemory<byte> secret, CancellationToken ct)
    {
        if (secret.Length == 0 || secret.Length > ProtocolConstants.MaxSecretBytes)
            throw new SupervisorException(SupervisorErrorCode.SecretFrameInvalid, "secret length");
        var header = new byte[4];
        System.Buffers.Binary.BinaryPrimitives.WriteUInt32LittleEndian(header, (uint)secret.Length);
        await stream.WriteAsync(header, ct).ConfigureAwait(false);
        await stream.WriteAsync(secret, ct).ConfigureAwait(false);
        await stream.FlushAsync(ct).ConfigureAwait(false);
    }

    public static async Task ReadExactAsync(Stream stream, byte[] buffer, CancellationToken ct)
    {
        var offset = 0;
        while (offset < buffer.Length)
        {
            var n = await stream.ReadAsync(buffer.AsMemory(offset, buffer.Length - offset), ct).ConfigureAwait(false);
            if (n == 0)
                throw new SupervisorException(SupervisorErrorCode.MalformedFrame, "stream closed before frame completed");
            offset += n;
        }
    }
}
