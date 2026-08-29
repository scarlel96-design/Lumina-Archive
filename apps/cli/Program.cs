using Lumina.Domain.Jobs;

static int Main(string[] args)
{
    if (args is ["--constitution"])
    {
        Console.WriteLine("Lumina.Cli G0");
        Console.WriteLine("JobStateMachine.CanTransition(Queued, Running)=" +
            JobStateMachine.CanTransition(JobState.Queued, JobState.Running));
        return 0;
    }

    Console.Error.WriteLine("G0: CLI job execution is not implemented. Phase G2.");
    return 2;
}
