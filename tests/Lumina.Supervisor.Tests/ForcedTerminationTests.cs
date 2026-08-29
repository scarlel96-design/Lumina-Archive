using Lumina.Domain.Jobs;
using Lumina.Supervisor.Jobs;
using Lumina.Supervisor.Recovery;
using Xunit;

namespace Lumina.Supervisor.Tests;

public class ForcedTerminationTests
{
    [Fact]
    public void SuccessfulTerminateRecordsForcedWithoutError()
    {
        var j = new JobJournal { JobId = "a", FailureCode = "HeartbeatTimeout", State = JobState.Interrupted };
        ForcedTerminationDiagnostics.Record(j, WorkerFailureCode.HeartbeatTimeout, terminateOk: true, win32Error: 0);
        Assert.True(j.ForcedTermination);
        Assert.Equal("HeartbeatTimeout", j.FailureCode);
        Assert.Null(j.TerminationErrorCode);
    }

    [Fact]
    public void FailedTerminateKeepsPrimaryAndRecordsWin32()
    {
        var j = new JobJournal { JobId = "a", FailureCode = "HeartbeatTimeout", State = JobState.Interrupted };
        ForcedTerminationDiagnostics.Record(j, WorkerFailureCode.HeartbeatTimeout, terminateOk: false, win32Error: 5);
        Assert.True(j.ForcedTermination);
        Assert.Equal("HeartbeatTimeout", j.FailureCode);
        Assert.Equal(5, j.TerminationErrorCode);
        Assert.DoesNotContain("LUMINA_G2_SECRET", j.FailureCode);
    }

    [Fact]
    public void HandshakePrimaryNotMaskedByTerminateFailure()
    {
        var j = new JobJournal { JobId = "a", FailureCode = "HandshakeTimeout", State = JobState.Interrupted };
        ForcedTerminationDiagnostics.Record(j, WorkerFailureCode.HandshakeTimeout, terminateOk: false, win32Error: 6);
        Assert.Equal("HandshakeTimeout", j.FailureCode);
        Assert.Equal(6, j.TerminationErrorCode);
    }
}
