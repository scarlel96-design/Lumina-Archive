namespace Lumina.Supervisor.Resources;

public sealed record ResourceRequest(int CpuThreads, long MemoryBytes, int IoSlots, int PreviewSlots);
public sealed record ResourceGrant(int CpuThreads, long MemoryBytes, int IoSlots, int PreviewSlots);
