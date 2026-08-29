using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Resources;

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

    public async Task<ResourceLease> AcquireAsync(ResourceRequest request, CancellationToken cancellationToken)
    {
        if (request.CpuThreads < 0 || request.MemoryBytes < 0 || request.IoSlots < 0 || request.PreviewSlots < 0)
            throw new SupervisorException(SupervisorErrorCode.ResourceRequestTooLarge, "negative resource request");
        if (request.CpuThreads > CpuBudget || request.MemoryBytes > MemoryBudgetBytes || request.IoSlots > IoBudget || request.PreviewSlots > PreviewBudget)
            throw new SupervisorException(SupervisorErrorCode.ResourceRequestTooLarge, "request exceeds policy maximum");

        var waiter = new Waiter(request, cancellationToken);
        lock (_gate)
        {
            if (TryReserveUnlocked(request))
                return new ResourceLease(this, ToGrant(request));
            _waiters.Enqueue(waiter);
        }

        try
        {
            await waiter.Tcs.Task.WaitAsync(cancellationToken).ConfigureAwait(false);
            return new ResourceLease(this, ToGrant(request));
        }
        catch
        {
            waiter.Cancel();
            lock (_gate) DrainWaitersUnlocked();
            throw;
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
            DrainWaitersUnlocked();
        }
    }

    private void DrainWaitersUnlocked()
    {
        var remaining = new Queue<Waiter>();
        while (_waiters.Count > 0)
        {
            var w = _waiters.Dequeue();
            if (w.IsCancelled)
                continue;
            if (TryReserveUnlocked(w.Request))
                w.Tcs.TrySetResult(true);
            else
                remaining.Enqueue(w);
        }
        while (remaining.Count > 0) _waiters.Enqueue(remaining.Dequeue());
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
        public Waiter(ResourceRequest request, CancellationToken ct)
        {
            Request = request;
            Ct = ct;
        }

        public ResourceRequest Request { get; }
        public CancellationToken Ct { get; }
        public TaskCompletionSource<bool> Tcs { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public bool IsCancelled => Ct.IsCancellationRequested || Tcs.Task.IsCompleted;
        public void Cancel() => Tcs.TrySetCanceled(Ct);
    }
}
