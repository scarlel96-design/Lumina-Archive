using System.IO.Pipes;
using System.Runtime.Versioning;
using System.Security.AccessControl;
using System.Security.Principal;
using Lumina.Supervisor.Errors;
using Lumina.Supervisor.Process;

namespace Lumina.Supervisor.Ipc;

[SupportedOSPlatform("windows")]
internal sealed class ControlPipeServer : IDisposable
{
    private readonly NamedPipeServerStream _pipe;
    public string Name { get; }

    public ControlPipeServer(string name)
    {
        Name = name;
        _pipe = Create(name, ProtocolConstants.MaxControlFrameBytes);
    }

    public Stream Stream => _pipe;

    public async Task WaitForClientAsync(uint expectedPid, CancellationToken ct)
    {
        await _pipe.WaitForConnectionAsync(ct).ConfigureAwait(false);
        var actual = PipePeerIdentity.GetClientProcessId(_pipe);
        PipePeerIdentity.AssertExpected(expectedPid, actual);
    }

    public void Dispose() => _pipe.Dispose();

    internal static NamedPipeServerStream Create(string name, int buffer)
    {
        var user = WindowsIdentity.GetCurrent().User
            ?? throw new SupervisorException(SupervisorErrorCode.WorkerLaunchFailed, "no current user SID");
        var security = new PipeSecurity();
        security.AddAccessRule(new PipeAccessRule(user, PipeAccessRights.ReadWrite | PipeAccessRights.CreateNewInstance, AccessControlType.Allow));
        return NamedPipeServerStreamAcl.Create(
            name,
            PipeDirection.InOut,
            maxNumberOfServerInstances: 1,
            PipeTransmissionMode.Byte,
            PipeOptions.Asynchronous,
            inBufferSize: buffer,
            outBufferSize: buffer,
            security);
    }
}

[SupportedOSPlatform("windows")]
internal sealed class SecretPipeServer : IDisposable
{
    private readonly NamedPipeServerStream _pipe;
    public string Name { get; }

    public SecretPipeServer(string name)
    {
        Name = name;
        _pipe = ControlPipeServer.Create(name, ProtocolConstants.MaxSecretBytes + 4);
    }

    public Stream Stream => _pipe;

    public async Task WaitForClientAsync(uint expectedPid, CancellationToken ct)
    {
        await _pipe.WaitForConnectionAsync(ct).ConfigureAwait(false);
        var actual = PipePeerIdentity.GetClientProcessId(_pipe);
        PipePeerIdentity.AssertExpected(expectedPid, actual);
    }

    public void Dispose() => _pipe.Dispose();
}
