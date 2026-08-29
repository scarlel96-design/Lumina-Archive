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

    [Fact]
    public async Task StrictFifoSmallRequestCannotBypassLargeHead()
    {
        var g = new ResourceGovernor(cpu: 4, memoryBytes: 1000, ioSlots: 4, previewSlots: 1);
        var a = await g.AcquireAsync(new ResourceRequest(3, 10, 1, 0), CancellationToken.None);
        var b = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        var first = g.AcquireAsync(new ResourceRequest(4, 10, 1, 0), CancellationToken.None);
        var second = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        await Task.Delay(20);
        Assert.False(first.IsCompleted);
        Assert.False(second.IsCompleted);
        b.Dispose();
        await Task.Delay(20);
        Assert.False(first.IsCompleted);
        Assert.False(second.IsCompleted);
        Assert.Equal(1, g.CpuAvailable);
        a.Dispose();
        var grantedFirst = await first;
        Assert.Equal(4, grantedFirst.Grant.CpuThreads);
        Assert.False(second.IsCompleted);
        grantedFirst.Dispose();
        using var grantedSecond = await second;
        Assert.Equal(1, grantedSecond.Grant.CpuThreads);
    }

    [Fact]
    public async Task NewRequestJoinsQueueWhenWaitersExist()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        var held = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        var first = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        await Task.Delay(10);
        var second = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        await Task.Delay(10);
        Assert.Equal(2, g.WaiterCount);
        held.Dispose();
        using var a = await first;
        Assert.False(second.IsCompleted);
        a.Dispose();
        using var b = await second;
        Assert.Equal(1, b.Grant.CpuThreads);
    }

    [Fact]
    public async Task CancellingHeadUnblocksNextWaiter()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        var held = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        using var cts = new CancellationTokenSource();
        var first = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), cts.Token);
        var second = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        await Task.Delay(15);
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => first);
        held.Dispose();
        using var next = await second;
        Assert.Equal(1, next.Grant.CpuThreads);
    }

    [Fact]
    public async Task ManyWaitersPreserveAdmissionOrder()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 10_000, ioSlots: 1, previewSlots: 1);
        var held = await g.AcquireAsync(new ResourceRequest(1, 1, 1, 0), CancellationToken.None);
        var order = new System.Collections.Concurrent.ConcurrentQueue<int>();
        var tasks = new List<Task>();
        for (var i = 0; i < 40; i++)
        {
            var id = i;
            tasks.Add(RecordAdmissionAsync(g, id, order));
        }
        held.Dispose();
        await Task.WhenAll(tasks);
        Assert.Equal(Enumerable.Range(0, 40), order.ToArray());
        Assert.True(g.BudgetsExact());
    }

    [Fact]
    public async Task PreCancelledAcquireDoesNotReserve()
    {
        var g = new ResourceGovernor(cpu: 2, memoryBytes: 100, ioSlots: 2, previewSlots: 1);
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), cts.Token));
        Assert.True(g.BudgetsExact());
    }

    [Fact]
    public async Task CancelWinsBeforeGrantRestoresNothingToLeak()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        var held = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        using var cts = new CancellationTokenSource();
        var pending = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), cts.Token);
        await Task.Delay(15);
        cts.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => pending);
        held.Dispose();
        Assert.True(g.BudgetsExact());
    }

    [Fact]
    public async Task GrantWinsAfterTokenCancelStillReturnsLease()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 100, ioSlots: 1, previewSlots: 1);
        var held = await g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), CancellationToken.None);
        using var cts = new CancellationTokenSource();
        var pending = g.AcquireAsync(new ResourceRequest(1, 10, 1, 0), cts.Token);
        await Task.Delay(15);
        held.Dispose();
        using var lease = await pending;
        cts.Cancel();
        Assert.Equal(1, lease.Grant.CpuThreads);
        lease.Dispose();
        Assert.True(g.BudgetsExact());
    }

    [Fact]
    public async Task GrantVsCancelStressNeverLeaks()
    {
        var g = new ResourceGovernor(cpu: 1, memoryBytes: 1000, ioSlots: 1, previewSlots: 1);
        for (var i = 0; i < 1000; i++)
        {
            var held = await g.AcquireAsync(new ResourceRequest(1, 1, 1, 0), CancellationToken.None);
            using var cts = new CancellationTokenSource();
            var pending = g.AcquireAsync(new ResourceRequest(1, 1, 1, 0), cts.Token);
            var releaser = Task.Run(() => held.Dispose());
            var canceller = Task.Run(cts.Cancel);
            await Task.WhenAll(releaser, canceller);
            try
            {
                var lease = await pending;
                lease.Dispose();
            }
            catch (OperationCanceledException)
            {
            }
            Assert.True(g.BudgetsExact());
        }
    }

    private static async Task RecordAdmissionAsync(ResourceGovernor g, int id, System.Collections.Concurrent.ConcurrentQueue<int> order)
    {
        using var lease = await g.AcquireAsync(new ResourceRequest(1, 1, 1, 0), CancellationToken.None);
        order.Enqueue(id);
    }
}
