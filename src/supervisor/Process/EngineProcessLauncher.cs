using System.ComponentModel;
using System.Runtime.Versioning;
using System.Text;
using Lumina.Supervisor.Errors;
using Lumina.Supervisor.Ipc;

namespace Lumina.Supervisor.Process;

public sealed class LaunchedWorker : IDisposable
{
    internal LaunchedWorker(SafeProcessHandleOwned process, SafeThreadHandle thread, WindowsJobObject job, int pid)
    {
        Process = process;
        Thread = thread;
        Job = job;
        Pid = pid;
    }

    internal SafeProcessHandleOwned Process { get; }
    internal SafeThreadHandle Thread { get; }
    internal WindowsJobObject Job { get; }
    public int Pid { get; }

    public uint? TryGetExitCode()
    {
        if (!NativeMethods.GetExitCodeProcess(Process.DangerousGetHandle(), out var code)) return null;
        return code == 259 ? null : code; // STILL_ACTIVE
    }

    public void Dispose()
    {
        Job.Dispose();
        Thread.Dispose();
        Process.Dispose();
    }
}

[SupportedOSPlatform("windows")]
public static class EngineProcessLauncher
{
    public static LaunchedWorker LaunchSuspended(string enginePath, Guid jobId, string controlPipe, string secretPipe)
    {
        if (!OperatingSystem.IsWindows())
            throw new SupervisorException(SupervisorErrorCode.PlatformUnsupported, "engine launch requires Windows");
        if (string.IsNullOrWhiteSpace(enginePath) || !File.Exists(enginePath))
            throw new SupervisorException(SupervisorErrorCode.WorkerLaunchFailed, "lumina-engine.exe missing");

        var cmd = new StringBuilder();
        Quote(cmd, enginePath);
        cmd.Append(" --job-id ").Append(jobId.ToString("D"));
        cmd.Append(" --protocol-version ").Append(ProtocolConstants.ProtocolVersion);
        cmd.Append(" --control-pipe ").Append(controlPipe);
        cmd.Append(" --secret-pipe ").Append(secretPipe);
        cmd.EnsureCapacity(cmd.Length + 32);

        var si = new NativeMethods.STARTUPINFOW { cb = System.Runtime.InteropServices.Marshal.SizeOf<NativeMethods.STARTUPINFOW>() };
        var flags = NativeMethods.CREATE_SUSPENDED | NativeMethods.CREATE_UNICODE_ENVIRONMENT | NativeMethods.CREATE_NO_WINDOW;
        if (!NativeMethods.CreateProcessW(enginePath, cmd, IntPtr.Zero, IntPtr.Zero, false, flags, IntPtr.Zero, Path.GetDirectoryName(enginePath), ref si, out var pi))
            throw new SupervisorException(SupervisorErrorCode.WorkerLaunchFailed, "CreateProcessW failed: " + new Win32Exception().NativeErrorCode);

        var process = new SafeProcessHandleOwned(pi.hProcess);
        var thread = new SafeThreadHandle(pi.hThread);
        WindowsJobObject? job = null;
        try
        {
            job = new WindowsJobObject();
            job.Assign(process);
            var resumed = NativeMethods.ResumeThread(thread.DangerousGetHandle());
            if (resumed == 0xFFFFFFFF)
                throw new SupervisorException(SupervisorErrorCode.WorkerResumeFailed, "ResumeThread failed: " + new Win32Exception().NativeErrorCode);
            return new LaunchedWorker(process, thread, job, pi.dwProcessId);
        }
        catch
        {
            job?.TryTerminate(1, out _);
            job?.Dispose();
            thread.Dispose();
            process.Dispose();
            throw;
        }
    }

    private static void Quote(StringBuilder sb, string path)
    {
        sb.Append('"').Append(path).Append('"');
    }
}
