namespace Lumina.Supervisor;

public sealed class ResourceGovernor
{
    public int CpuThreadBudget { get; init; } = Math.Max(1, Environment.ProcessorCount);
    public long MemoryBudgetBytes { get; init; } = 512L * 1024 * 1024;
    public int PreviewSlots { get; init; } = 2;
}
