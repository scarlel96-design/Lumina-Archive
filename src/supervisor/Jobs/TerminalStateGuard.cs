using Lumina.Domain.Jobs;

namespace Lumina.Supervisor.Jobs;

public sealed class TerminalStateGuard
{
    private readonly object _gate = new();
    private JobState _state;
    private bool _terminal;

    private bool _cancelRequested;

    public TerminalStateGuard(JobState initial = JobState.Running)
    {
        _state = initial;
        _terminal = IsTerminal(initial);
    }

    public JobState State { get { lock (_gate) return _state; } }
    public bool IsCommitted { get { lock (_gate) return _terminal; } }

    public static bool IsTerminal(JobState state) =>
        state is JobState.Succeeded or JobState.Failed or JobState.Cancelled or JobState.Interrupted;

    public bool TryCommit(JobState candidate)
    {
        lock (_gate)
        {
            if (_terminal) return false;
            if (!IsTerminal(candidate) && candidate is not (JobState.Running or JobState.Paused or JobState.Queued))
                return false;
            if (IsTerminal(candidate))
            {
                _state = candidate;
                _terminal = true;
                return true;
            }
            _state = candidate;
            return true;
        }
    }

    public JobCancellationResult RequestCancel()
    {
        lock (_gate)
        {
            if (_terminal) return JobCancellationResult.AlreadyTerminal;
            if (_cancelRequested) return JobCancellationResult.AlreadyRequested;
            _cancelRequested = true;
            return JobCancellationResult.Accepted;
        }
    }
}
