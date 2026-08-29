using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Resources;

internal enum WaiterState
{
    Queued,
    Granted,
    Cancelled,
}

public sealed class ResourceGovernor
{
    private readonly object _gate = new();
    private readonly Queue<Waiter> _waiters = new();
    private int _cpuAvailable;
    private long _memoryAvailable;
    private int _ioAvailable;
    private int _previewAvailable;

    public ResourceGovernor(int? cpu = null, long? memoryBytes = null, int ioSlots = 4, int previewSlots = 2)
    {
        CpuBudget = Math.Max(1, cpu ?? Environment.ProcessorCount);
        MemoryBudgetBytes = Math.Max(1, memoryBytes ?? 512L * 1024 * 1024);
        IoBudget = Math.Max(1, ioSlots);
        PreviewBudget = Math.Max(1, previewSlots);
        _cpuAvailable = CpuBudget;
        _memoryAvailable = MemoryBudgetBytes;
        _ioAvailable = IoBudget;
        _previewAvailable = PreviewBudget;
    }

    public int CpuBudget { get; }
    public long MemoryBudgetBytes { get; }
    public int IoBudget { get; }
    public int PreviewBudget { get; }

    public int CpuAvailable { get { lock (_gate) return _cpuAvailable; } }
    public long MemoryAvailable { get { lock (_gate) return _memoryAvailable; } }
    public int IoAvailable { get { lock (_gate) return _ioAvailable; } }
    public int PreviewAvailable { get { lock (_gate) return _previewAvailable; } }
    public int WaiterCount { get { lock (_gate) return _waiters.Count; } }

    public bool BudgetsExact()
    {
        lock (_gate)
        {
            return _waiters.Count == 0
                && _cpuAvailable == CpuBudget
                && _memoryAvailable == MemoryBudgetBytes
                && _ioAvailable == IoBudget
                && _previewAvailable == PreviewBudget;
        }
    }

    public async Task<ResourceLease> AcquireAsync(ResourceRequest request, CancellationToken cancellationToken)
    {
        cancellationToken.ThrowIfCancellationRequested();
        if (request.CpuThreads < 0 || request.MemoryBytes < 0 || request.IoSlots < 0 || request.PreviewSlots < 0)
            throw new SupervisorException(SupervisorErrorCode.ResourceRequestTooLarge, "negative resource request");
        if (request.CpuThreads > CpuBudget || request.MemoryBytes > MemoryBudgetBytes || request.IoSlots > IoBudget || request.PreviewSlots > PreviewBudget)
            throw new SupervisorException(SupervisorErrorCode.ResourceRequestTooLarge, "request exceeds policy maximum");

        Waiter waiter;
        lock (_gate)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (_waiters.Count == 0 && TryReserveUnlocked(request))
                return new ResourceLease(this, ToGrant(request));
            waiter = new Waiter(request);
            _waiters.Enqueue(waiter);
        }

        using (cancellationToken.Register(() => TryCancelWaiter(waiter)))
        {
            await waiter.Tcs.Task.ConfigureAwait(false);
            return new ResourceLease(this, ToGrant(request));
        }
    }

    internal void Release(ResourceLease lease)
    {
        lock (_gate)
        {
            _cpuAvailable += lease.Grant.CpuThreads;
            _memoryAvailable += lease.Grant.MemoryBytes;
            _ioAvailable += lease.Grant.IoSlots;
            _previewAvailable += lease.Grant.PreviewSlots;
            if (_cpuAvailable > CpuBudget) _cpuAvailable = CpuBudget;
            if (_memoryAvailable > MemoryBudgetBytes) _memoryAvailable = MemoryBudgetBytes;
            if (_ioAvailable > IoBudget) _ioAvailable = IoBudget;
            if (_previewAvailable > PreviewBudget) _previewAvailable = PreviewBudget;
            DrainWaitersUnlocked();
        }
    }

    private void TryCancelWaiter(Waiter waiter)
    {
        lock (_gate)
        {
            if (waiter.State != WaiterState.Queued)
                return;
            waiter.State = WaiterState.Cancelled;
            waiter.Tcs.TrySetCanceled();
            DrainWaitersUnlocked();
        }
    }

    private void DrainWaitersUnlocked()
    {
        while (_waiters.Count > 0)
        {
            var head = _waiters.Peek();
            if (head.State == WaiterState.Cancelled)
            {
                _waiters.Dequeue();
                continue;
            }
            if (head.State != WaiterState.Queued)
            {
                _waiters.Dequeue();
                continue;
            }
            if (!TryReserveUnlocked(head.Request))
                return;
            head.State = WaiterState.Granted;
            _waiters.Dequeue();
            head.Tcs.TrySetResult(true);
        }
    }

    private bool TryReserveUnlocked(ResourceRequest request)
    {
        if (_cpuAvailable < request.CpuThreads || _memoryAvailable < request.MemoryBytes || _ioAvailable < request.IoSlots || _previewAvailable < request.PreviewSlots)
            return false;
        _cpuAvailable -= request.CpuThreads;
        _memoryAvailable -= request.MemoryBytes;
        _ioAvailable -= request.IoSlots;
        _previewAvailable -= request.PreviewSlots;
        return true;
    }

    private static ResourceGrant ToGrant(ResourceRequest request) =>
        new(request.CpuThreads, request.MemoryBytes, request.IoSlots, request.PreviewSlots);

    private sealed class Waiter
    {
        public Waiter(ResourceRequest request) => Request = request;
        public ResourceRequest Request { get; }
        public WaiterState State { get; set; } = WaiterState.Queued;
        public TaskCompletionSource<bool> Tcs { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
    }
}
