using Lumina.Domain.Jobs;

namespace Lumina.Cli;

internal static class Program
{
    private static int Main(string[] args)
    {
        if (args is ["--bench-identity"])
        {
            Console.WriteLine("{\"product\":\"Lumina Archive\",\"version\":\"0.0.0-g1\",\"engine\":\"not-linked\",\"phase\":\"G1\"}");
            return 0;
        }

        if (args is ["--constitution"])
        {
            Console.WriteLine("Lumina.Cli G0");
            Console.WriteLine("JobStateMachine.CanTransition(Queued, Running)=" +
                JobStateMachine.CanTransition(JobState.Queued, JobState.Running));
            return 0;
        }

        Console.Error.WriteLine("G1: CLI job execution is not implemented. Phase G2.");
        return 2;
    }
}
