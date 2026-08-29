namespace Lumina.Supervisor.Resources;

public sealed class ResourceLease : IDisposable
{
    private readonly ResourceGovernor _governor;
    private int _disposed;

    internal ResourceLease(ResourceGovernor governor, ResourceGrant grant)
    {
        _governor = governor;
        Grant = grant;
    }

    public ResourceGrant Grant { get; }

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _disposed, 1) != 0) return;
        _governor.Release(this);
    }
}
