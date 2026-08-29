using Lumina.Supervisor.Jobs;

namespace Lumina.Supervisor.Recovery;

internal static class ForcedTerminationDiagnostics
{
    public static void Record(JobJournal journal, WorkerFailureCode primary, bool terminateOk, int win32Error)
    {
        journal.ForcedTermination = true;
        if (string.IsNullOrEmpty(journal.FailureCode) && primary != WorkerFailureCode.None)
            journal.FailureCode = primary.ToString();
        if (!terminateOk)
            journal.TerminationErrorCode = win32Error;
    }
}
