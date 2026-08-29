using Lumina.Domain.Jobs;
using Lumina.Supervisor.Jobs;
using Xunit;

namespace Lumina.Supervisor.Tests;

public class TerminalRaceTests
{
    [Fact]
    public void CompletedCannotBeOverwrittenByCancel()
    {
        var g = new TerminalStateGuard(JobState.Running);
        Assert.True(g.TryCommit(JobState.Succeeded));
        Assert.Equal(JobCancellationResult.AlreadyTerminal, g.RequestCancel());
        Assert.False(g.TryCommit(JobState.Cancelled));
        Assert.Equal(JobState.Succeeded, g.State);
    }

    [Fact]
    public void FailedCannotBecomeCancelled()
    {
        var g = new TerminalStateGuard(JobState.Running);
        Assert.True(g.TryCommit(JobState.Failed));
        Assert.False(g.TryCommit(JobState.Cancelled));
        Assert.Equal(JobState.Failed, g.State);
    }

    [Fact]
    public void DuplicateCompletedIsNoOp()
    {
        var g = new TerminalStateGuard(JobState.Running);
        Assert.True(g.TryCommit(JobState.Succeeded));
        Assert.False(g.TryCommit(JobState.Succeeded));
    }

    [Fact]
    public async Task ConcurrentCompletedVsCancel()
    {
        for (var i = 0; i < 200; i++)
        {
            var g = new TerminalStateGuard(JobState.Running);
            var t1 = Task.Run(() => g.TryCommit(JobState.Succeeded));
            var t2 = Task.Run(() => g.RequestCancel());
            await Task.WhenAll(t1, t2);
            Assert.True(TerminalStateGuard.IsTerminal(g.State));
            Assert.NotEqual(JobState.Running, g.State);
            if (g.State == JobState.Succeeded)
                Assert.Equal(JobCancellationResult.AlreadyTerminal, g.RequestCancel());
        }
    }

    [Fact]
    public void CancelVsCancelSecondIsAlreadyRequestedOrTerminal()
    {
        var g = new TerminalStateGuard(JobState.Running);
        Assert.Equal(JobCancellationResult.Accepted, g.RequestCancel());
        var second = g.RequestCancel();
        Assert.True(second is JobCancellationResult.Accepted or JobCancellationResult.AlreadyRequested or JobCancellationResult.AlreadyTerminal);
    }

    [Fact]
    public void HeartbeatAfterCompletedDoesNotChangeState()
    {
        var g = new TerminalStateGuard(JobState.Running);
        Assert.True(g.TryCommit(JobState.Succeeded));
        Assert.False(g.TryCommit(JobState.Running));
        Assert.Equal(JobState.Succeeded, g.State);
    }
}
