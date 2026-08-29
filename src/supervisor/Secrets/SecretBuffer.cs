using System.Security.Cryptography;

namespace Lumina.Supervisor.Secrets;

public sealed class SecretBuffer : IDisposable
{
    private byte[]? _bytes;

    public SecretBuffer(ReadOnlySpan<byte> value)
    {
        _bytes = value.ToArray();
    }

    public int Length => _bytes?.Length ?? 0;

    public ReadOnlySpan<byte> Span => _bytes ?? ReadOnlySpan<byte>.Empty;

    public void Dispose()
    {
        if (_bytes is null) return;
        CryptographicOperations.ZeroMemory(_bytes);
        _bytes = null;
    }
}

public interface ISecretSource
{
    SecretBuffer? TryOpen();
}
