using System.Text.Json;
using Lumina.Supervisor.Errors;

namespace Lumina.Supervisor.Recovery;

public sealed class JobJournalStore
{
    private readonly string _root;
    private readonly object _io = new();
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower,
        WriteIndented = false,
    };

    public JobJournalStore(string root)
    {
        _root = root;
        Directory.CreateDirectory(_root);
    }

    public string PathFor(string jobId) => Path.Combine(_root, jobId + ".json");

    public void WriteAtomic(JobJournal journal)
    {
        lock (_io)
        {
            var path = PathFor(journal.JobId);
            var tmp = path + "." + Guid.NewGuid().ToString("N") + ".tmp";
            var json = JsonSerializer.Serialize(journal, Options);
            var bytes = System.Text.Encoding.UTF8.GetBytes(json);
            using (var fs = new FileStream(tmp, FileMode.Create, FileAccess.Write, FileShare.None, 4096, FileOptions.None))
            {
                fs.Write(bytes);
                fs.Flush(flushToDisk: true);
            }
            if (File.Exists(path))
                File.Replace(tmp, path, destinationBackupFileName: null);
            else
                File.Move(tmp, path);
        }
    }

    public JobJournal? TryRead(string jobId)
    {
        var path = PathFor(jobId);
        if (!File.Exists(path)) return null;
        return ReadFile(path);
    }

    public IEnumerable<JobJournal> ReadAll()
    {
        foreach (var file in Directory.EnumerateFiles(_root, "*.json"))
            yield return ReadFile(file);
    }

    private static JobJournal ReadFile(string path)
    {
        try
        {
            var text = File.ReadAllText(path);
            var journal = JsonSerializer.Deserialize<JobJournal>(text, Options);
            if (journal is null || string.IsNullOrWhiteSpace(journal.JobId))
                throw new SupervisorException(SupervisorErrorCode.JournalCorrupt, "empty journal");
            return journal;
        }
        catch (SupervisorException)
        {
            Quarantine(path);
            throw;
        }
        catch (Exception ex)
        {
            Quarantine(path);
            throw new SupervisorException(SupervisorErrorCode.JournalCorrupt, "RecoveryJournalCorrupt", ex);
        }
    }

    private static void Quarantine(string path)
    {
        try
        {
            var dest = path + ".corrupt-" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
            if (File.Exists(path)) File.Move(path, dest);
        }
        catch
        {
            // keep original if rename fails; caller still fails closed
        }
    }
}
