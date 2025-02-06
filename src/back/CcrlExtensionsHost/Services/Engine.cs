using System.Diagnostics;
using System.Text.RegularExpressions;
using CcrlExtensionsHost.Configs;
using CcrlExtensionsHost.Models;

namespace CcrlExtensionsHost.Services;

public partial class Engine
{
    private const int GracefulShutdownTime = 3_000;

    private readonly ILogger<Engine> _logger;
    private Process? _process;
    private string? _currentFen;

    public EngineConfig? Config { get; private set; }
    public EngineInfo? CurrentEngineInfo { get; private set; }

    public Engine(ILogger<Engine> logger)
    {
        _logger = logger;
    }

    public async Task RunAsync(EngineConfig config)
    {
        Config = config;
        _logger.LogInformation("Running {EngineName} at {EnginePath}", config.Name, config.Path);

        if (!File.Exists(config.Path))
        {
            _logger.LogWarning("Engine at {EnginePath} doesn't exist.", config.Path);
            return;
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = config.Path,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = false,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        _process = Process.Start(startInfo);
        if (_process is null)
        {
            _logger.LogError("Unexpected error starting engine process");
            return;
        }

        await SendAsync("uci");
        if (config.Options != null)
        {
            foreach (var option in config.Options)
            {
                await SendAsync($"setoption name {option.Name} value {option.Value}");
            }
        }
        while (true)
        {
            if (_process.HasExited)
            {
                _logger.Log(
                    _process.ExitCode == 0 ? LogLevel.Information : LogLevel.Error,
                    "Engine {EngineName} has exited with exit code {EngineExitCode}", config.Name, _process.ExitCode);

                return;
            }

            var line = await _process.StandardOutput.ReadLineAsync();
            HandleOutput(line);
        }
    }

    private void HandleOutput(string? line)
    {
        _logger.LogDebug("{EngineName} >> {EngineOutput}", Config?.Name, line);

        var success = TryGetEngineInfo(line, out var info);
        if (success)
        {
            CurrentEngineInfo = info;
        }
    }

    [GeneratedRegex(" score cp (-?\\d+)", RegexOptions.Compiled)]
    private static partial Regex CpRegex();
    private readonly Regex _cpRegex = CpRegex();

    [GeneratedRegex(" depth (\\d+)", RegexOptions.Compiled)]
    private static partial Regex DepthRegex();
    private readonly Regex _depthRegex = DepthRegex();

    [GeneratedRegex(" nodes (\\d+)", RegexOptions.Compiled)]
    private static partial Regex NodesRegex();
    private readonly Regex _nodesRegex = NodesRegex();

    [GeneratedRegex(" nps (\\d+)", RegexOptions.Compiled)]
    private static partial Regex NpsRegex();
    private readonly Regex _npsRegex = NpsRegex();

    [GeneratedRegex(" pv (.+)", RegexOptions.Compiled)]
    private static partial Regex PvRegex();
    private readonly Regex _pvRegex = PvRegex();

    private bool TryGetEngineInfo(string? line, out EngineInfo info)
    {
        info = new EngineInfo();
        if (string.IsNullOrEmpty(line))
        {
            return false;
        }

        if (!line.Contains("info"))
        {
            if (line.Contains("uciok"))
            {
                info.Name = Config?.Name;

                return true;
            }

            return false;
        }

        if (line.Contains("lowerbound"))
        {
            return false;
        }

        if (line.Contains("upperbound"))
        {
            return false;
        }

        if (line.Contains("currmove"))
        {
            return false;
        }

        info.Name = Config?.Name;

        var cpMatch = _cpRegex.Match(line);
        if (cpMatch.Success)
        {
            if (int.TryParse(cpMatch.Groups[1].Value, out var cp))
            {
                if (_currentFen?.Contains(" b ") == true)
                {
                    cp = -cp;
                }
                info.Score = cp.ToString();
            }
        }

        var depthMatch = _depthRegex.Match(line);
        if (depthMatch.Success)
        {
            if (int.TryParse(depthMatch.Groups[1].Value, out var depth))
            {
                info.Depth = depth;
            }
        }

        var nodesMatch = _nodesRegex.Match(line);
        if (nodesMatch.Success)
        {
            if (long.TryParse(nodesMatch.Groups[1].Value, out var nodes))
            {
                info.Nodes = nodes;
            }
        }

        var npsMatch = _npsRegex.Match(line);
        if (npsMatch.Success)
        {
            if (long.TryParse(npsMatch.Groups[1].Value, out var nps))
            {
                info.Nps = nps;
            }
        }

        var pvMatch = _pvRegex.Match(line);
        if (pvMatch.Success)
        {
            info.Pv = pvMatch.Groups[1].Value;
        }

        return true;
    }

    private async Task SendAsync(string line)
    {
        if (_process is null)
        {
            _logger.LogError("Engine process not started");
            return;
        }

        _logger.LogDebug("{EngineName} << {EngineOutput}", Config?.Name, line);
        await _process.StandardInput.WriteLineAsync(line);
    }

    public async Task SetFenAsync(string fen)
    {
        if (_process?.HasExited == false)
        {
            _currentFen = fen;
            await SendAsync("stop");
            if (fen == "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1")
            {
                await SendAsync("ucinewgame");
            }
            await SendAsync($"position fen {fen}");
            await SendAsync("go infinite");
        }
    }

    public async Task ShutDown()
    {
        if (_process is not null)
        {
            if (!_process.HasExited)
            {
                _logger.LogInformation("Shutting down {EngineName} at {EnginePath}", Config?.Name, Config?.Path);
                await SendAsync("quit");

                await Task.Delay(100);

                if (!_process.HasExited)
                {
                    await Task.Delay(GracefulShutdownTime);
                }

                if (!_process.HasExited)
                {
                    _logger.LogWarning("Engine {EngineName} at {EnginePath} might still be running", Config?.Name, Config?.Path);
                }
            }

            _process?.Close();
        }
    }
}
