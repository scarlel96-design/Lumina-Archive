using System.Buffers.Binary;
using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Ipc;

public static class IpcFrame
{
    public static byte[] Encode(ReadOnlySpan<byte> utf8Json)
    {
        if (utf8Json.Length == 0)
            throw new SupervisorException(SupervisorErrorCode.MalformedFrame, "empty control payload");
        if (utf8Json.Length > ProtocolConstants.MaxControlFrameBytes)
            throw new SupervisorException(SupervisorErrorCode.FrameTooLarge, "control frame exceeds 1 MiB");
        var buffer = new byte[4 + utf8Json.Length];
        BinaryPrimitives.WriteUInt32LittleEndian(buffer, (uint)utf8Json.Length);
        utf8Json.CopyTo(buffer.AsSpan(4));
        return buffer;
    }

    public static int DecodeLength(ReadOnlySpan<byte> header)
    {
        if (header.Length < 4)
            throw new SupervisorException(SupervisorErrorCode.MalformedFrame, "short header");
        var length = BinaryPrimitives.ReadUInt32LittleEndian(header);
        if (length == 0)
            throw new SupervisorException(SupervisorErrorCode.MalformedFrame, "length == 0");
        if (length > ProtocolConstants.MaxControlFrameBytes)
            throw new SupervisorException(SupervisorErrorCode.FrameTooLarge, "control frame exceeds 1 MiB");
        return (int)length;
    }
}
