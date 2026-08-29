using Lumina.Supervisor.Errors;
using Lumina.Supervisor.Resources;
using Xunit;

namespace Lumina.Supervisor.Tests;

public class ResourceGovernorTests
{
    [Fact]
    public async Task SingleLease()
    {
        var g = new ResourceGovernor(cpu: 4, memoryBytes: 1000, ioSlots: 2, previewSlots: 1);
        var lease = await g.AcquireAsync(new ResourceRequest(1, 100, 1, 0), CancellationToken.None);
        Assert.Equal(1, lease.Grant.CpuThreads);
        lease.Dispose();
        Assert.Equal(4, g.CpuAvailable);
    }

    [Fact]
    public async Task ExhaustionWaitsThenRuns()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        var a = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        var waiting = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        Assert.False(waiting.IsCompleted);
        a.Dispose();
        using var b = await waiting;
        Assert.Equal(1, b.Grant.CpuThreads);
    }

    [Fact]
    public async Task WaitingCancellationDoesNotLeak()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        var held = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        using var cts = new CancellationTokenSource();
        var waiting = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), cts.Token);
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => waiting);
        held.Dispose();
        using var next = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        Assert.Equal(1, next.Grant.CpuThreads);
    }

    [Fact]
    public async Task OversizedFailsFast()
    {
        var g = new ResourceGovernor(cpu: 2, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        await Assert.ThrowsAsync<SupervisorException>(() => g.AcquireAsync(new ResourceRequest(8, 10, 1, 0), CancellationToken.None));
        await Assert.ThrowsAsync<SupervisorException>(() => g.AcquireAsync(new ResourceRequest(1, 10_000, 1, 0), CancellationToken.None));
    }

    [Fact]
    public async Task DoubleDisposeIsSafe()
    {
        var g = new ResourceGovernor(cpu: 2, memoryBytes: 100, ioSlots: 2, previewSlots: 1);
        var lease = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        lease.Dispose();
        lease.Dispose();
        Assert.Equal(2, g.CpuAvailable);
    }

    [Fact]
    public async Task ConcurrentAcquireReleaseNoOverflow()
    {
        var g = new ResourceGovernor(cpu: 4, memoryBytes: 10_000, ioSlots: 8, previewSlots: 2);
        var tasks = Enumerable.Range(0, 80).Select(async _ =>
        {
            var lease = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
            await Task.Yield();
            lease.Dispose();
        });
        await Task.WhenAll(tasks);
        Assert.Equal(4, g.CpuAvailable);
    }

    [Fact]
    public async Task NegativeRejected()
    {
        var g = new ResourceGovernor(cpu: 2, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        await Assert.ThrowsAsync<SupervisorException>(() => g.AcquireAsync(new ResourceRequest(-1, 10, 1, 0), CancellationToken.None));
    }

    [Fact]
    public async Task IoAndPreviewExhaustion()
    {
        var g = new ResourceGovernor(cpu: 8, memoryBytes: 10_000, ioSlots: 1, previewSlots: 1);
        var io = await g.AcquireAsync(new ResourceRequest(0, 0, 1, 0), CancellationToken.None);
        var preview = await g.AcquireAsync(new ResourceRequest(0, 0, 0, 1), CancellationToken.None);
        var waitIo = g.AcquireAsync(new ResourceRequest(0, 0, 1, 0), CancellationToken.None);
        var waitPrev = g.AcquireAsync(new ResourceRequest(0, 0, 0, 1), CancellationToken.None);
        Assert.False(waitIo.IsCompleted);
        Assert.False(waitPrev.IsCompleted);
        io.Dispose();
        preview.Dispose();
        (await waitIo).Dispose();
        (await waitPrev).Dispose();
    }
}
