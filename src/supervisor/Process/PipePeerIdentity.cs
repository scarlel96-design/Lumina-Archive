using System.IO.Pipes;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Process;

public static class PipePeerIdentity
{
    public static bool Matches(uint expectedPid, uint actualPid) => expectedPid != 0 && expectedPid == actualPid;

    [SupportedOSPlatform("windows")]
    public static uint GetClientProcessId(PipeStream pipe)
    {
        if (!OperatingSystem.IsWindows())
            throw new SupervisorException(SupervisorErrorCode.PlatformUnsupported, "named pipe PID requires Windows");
        var handle = pipe.SafePipeHandle.DangerousGetHandle();
        if (!NativeMethods.GetNamedPipeClientProcessId(handle, out var pid))
            throw new SupervisorException(SupervisorErrorCode.PipePeerMismatch, "GetNamedPipeClientProcessId failed: " + Marshal.GetLastWin32Error());
        return pid;
    }

    public static void AssertExpected(uint expectedPid, uint actualPid)
    {
        if (!Matches(expectedPid, actualPid))
            throw new SupervisorException(SupervisorErrorCode.PipePeerMismatch, "pipe client PID mismatch");
    }
}
