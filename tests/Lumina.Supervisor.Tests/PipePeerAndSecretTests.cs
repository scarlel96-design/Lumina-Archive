using Lumina.Supervisor.Ipc;
using Lumina.Supervisor.Process;
using Lumina.Supervisor.Secrets;
using Xunit;

namespace Lumina.Supervisor.Tests;

public class PipePeerAndSecretTests
{
    [Fact]
    public void PidMatch()
    {
        Assert.True(PipePeerIdentity.Matches(42, 42));
        Assert.False(PipePeerIdentity.Matches(42, 43));
        Assert.False(PipePeerIdentity.Matches(0, 0));
        Assert.Throws<Lumina.Supervisor.Errors.SupervisorException>(() => PipePeerIdentity.AssertExpected(1, 2));
    }

    [Fact]
    public void SecretBufferZerosOnDispose()
    {
        var raw = "LUMINA_G2_SECRET_SENTINEL_UNIT"u8.ToArray();
        var copy = (byte[])raw.Clone();
        var buf = new SecretBuffer(copy);
        Assert.Equal(raw.Length, buf.Length);
        buf.Dispose();
        Assert.Equal(0, buf.Length);
    }

    [Fact]
    public void SecretLengthBounds()
    {
        Assert.Equal(64 * 1024, ProtocolConstants.MaxSecretBytes);
        Assert.Equal(1024 * 1024, ProtocolConstants.MaxControlFrameBytes);
    }
}
