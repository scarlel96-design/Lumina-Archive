using Microsoft.Win32.SafeHandles;

namespace Lumina.Supervisor.Process;

internal sealed class SafeJobHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeJobHandle() : base(ownsHandle: true) { }

    public SafeJobHandle(IntPtr handle) : base(ownsHandle: true) => SetHandle(handle);

    protected override bool ReleaseHandle() => NativeMethods.CloseHandle(handle);
}

internal sealed class SafeProcessHandleOwned : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeProcessHandleOwned() : base(true) { }
    public SafeProcessHandleOwned(IntPtr handle) : base(true) => SetHandle(handle);
    protected override bool ReleaseHandle() => NativeMethods.CloseHandle(handle);
}

internal sealed class SafeThreadHandle : SafeHandleZeroOrMinusOneIsInvalid
{
    public SafeThreadHandle() : base(true) { }
    public SafeThreadHandle(IntPtr handle) : base(true) => SetHandle(handle);
    protected override bool ReleaseHandle() => NativeMethods.CloseHandle(handle);
}
