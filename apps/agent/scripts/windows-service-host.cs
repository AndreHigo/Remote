using System;
using System.Diagnostics;
using System.IO;
using System.ServiceProcess;
using System.Threading;

public sealed class RemotoAgentService : ServiceBase
{
    private readonly object sync = new object();
    private readonly string baseDirectory = AppDomain.CurrentDomain.BaseDirectory;
    private Process child;
    private bool stopping;

    public RemotoAgentService()
    {
        ServiceName = "RemotoAgent";
        CanStop = true;
        CanShutdown = true;
        AutoLog = true;
    }

    protected override void OnStart(string[] args)
    {
        stopping = false;
        StartAgent();
    }

    protected override void OnStop()
    {
        stopping = true;
        StopAgent();
    }

    protected override void OnShutdown()
    {
        stopping = true;
        StopAgent();
        base.OnShutdown();
    }

    private void StartAgent()
    {
        lock (sync)
        {
            if (stopping || (child != null && !child.HasExited)) return;

            string agentPath = Path.Combine(baseDirectory, "RemotoAgent.exe");
            if (!File.Exists(agentPath)) throw new FileNotFoundException("RemotoAgent.exe nao encontrado.", agentPath);

            string logDirectory = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData),
                "Remoto", "logs");
            Directory.CreateDirectory(logDirectory);

            string stdoutPath = Path.Combine(logDirectory, "agent.stdout.log");
            string stderrPath = Path.Combine(logDirectory, "agent.stderr.log");
            var startInfo = new ProcessStartInfo
            {
                FileName = agentPath,
                Arguments = "loop",
                WorkingDirectory = baseDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };

            child = new Process { StartInfo = startInfo, EnableRaisingEvents = true };
            child.OutputDataReceived += (sender, eventArgs) => AppendLog(stdoutPath, eventArgs.Data);
            child.ErrorDataReceived += (sender, eventArgs) => AppendLog(stderrPath, eventArgs.Data);
            child.Exited += ChildExited;
            child.Start();
            child.BeginOutputReadLine();
            child.BeginErrorReadLine();
        }
    }

    private void ChildExited(object sender, EventArgs args)
    {
        lock (sync)
        {
            if (stopping) return;
            child = null;
        }

        ThreadPool.QueueUserWorkItem(state =>
        {
            Thread.Sleep(5000);
            if (!stopping)
            {
                try { StartAgent(); } catch { }
            }
        });
    }

    private void StopAgent()
    {
        lock (sync)
        {
            if (child == null) return;
            try
            {
                if (!child.HasExited) child.Kill();
                child.WaitForExit(5000);
            }
            catch { }
            finally
            {
                child.Dispose();
                child = null;
            }
        }
    }

    private static void AppendLog(string path, string message)
    {
        if (String.IsNullOrEmpty(message)) return;
        try { File.AppendAllText(path, DateTime.UtcNow.ToString("o") + " " + message + Environment.NewLine); }
        catch { }
    }

    public static void Main()
    {
        ServiceBase.Run(new RemotoAgentService());
    }
}
