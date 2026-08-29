using Lumina.Domain.Jobs;
using Xunit;

namespace Lumina.Domain.Tests;

public class JobStateMachineTests
{
    [Fact]
    public void CompletedJobCannotBeCancelled()
    {
        Assert.False(JobStateMachine.CanTransition(JobState.Succeeded, JobState.Cancelled));
    }

    [Fact]
    public void QueuedCanRun()
    {
        Assert.True(JobStateMachine.CanTransition(JobState.Queued, JobState.Running));
    }
}
