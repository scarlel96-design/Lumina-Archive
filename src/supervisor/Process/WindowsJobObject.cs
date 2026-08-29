using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Process;

[SupportedOSPlatform("windows")]
internal sealed class WindowsJobObject : IDisposable
{
    private readonly SafeJobHandle _handle;

    public WindowsJobObject()
    {
        var raw = NativeMethods.CreateJobObjectW(IntPtr.Zero, null);
        if (raw == IntPtr.Zero)
            throw new SupervisorException(SupervisorErrorCode.JobObjectCreateFailed, "CreateJobObjectW failed: " + new Win32Exception().NativeErrorCode);
        _handle = new SafeJobHandle(raw);
        var info = new NativeMethods.JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
        info.BasicLimitInformation.LimitFlags = NativeMethods.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE | NativeMethods.JOB_OBJECT_LIMIT_ACTIVE_PROCESS;
        info.BasicLimitInformation.ActiveProcessLimit = 1;
        if (!NativeMethods.SetInformationJobObject(_handle.DangerousGetHandle(), NativeMethods.JobObjectExtendedLimitInformation, ref info, System.Runtime.InteropServices.Marshal.SizeOf<NativeMethods.JOBOBJECT_EXTENDED_LIMIT_INFORMATION>()))
            throw new SupervisorException(SupervisorErrorCode.JobObjectCreateFailed, "SetInformationJobObject failed: " + new Win32Exception().NativeErrorCode);
    }

    public SafeJobHandle Handle => _handle;

    public void Assign(SafeProcessHandleOwned process)
    {
        if (!NativeMethods.AssignProcessToJobObject(_handle.DangerousGetHandle(), process.DangerousGetHandle()))
            throw new SupervisorException(SupervisorErrorCode.JobObjectAssignFailed, "AssignProcessToJobObject failed: " + new Win32Exception().NativeErrorCode);
        if (!NativeMethods.IsProcessInJob(process.DangerousGetHandle(), _handle.DangerousGetHandle(), out var inside) || !inside)
            throw new SupervisorException(SupervisorErrorCode.JobObjectAssignFailed, "process not in job after assign");
    }

    public bool TryTerminate(uint exitCode, out int win32Error)
    {
        if (_handle.IsInvalid || _handle.IsClosed)
        {
            win32Error = 6; // ERROR_INVALID_HANDLE
            return false;
        }
        if (!NativeMethods.TerminateJobObject(_handle.DangerousGetHandle(), exitCode))
        {
            win32Error = Marshal.GetLastWin32Error();
            return false;
        }
        win32Error = 0;
        return true;
    }

    public void Terminate(uint exitCode = 1)
    {
        if (!TryTerminate(exitCode, out var err))
            throw new SupervisorException(SupervisorErrorCode.JobObjectTerminateFailed, "TerminateJobObject failed: " + err);
    }

    public void Dispose() => _handle.Dispose();
}
