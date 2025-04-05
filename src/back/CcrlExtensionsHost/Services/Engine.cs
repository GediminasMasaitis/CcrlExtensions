using System.Diagnostics;
using System.Globalization;
using System.Text.RegularExpressions;
using CcrlExtensionsHost.Configs;
using CcrlExtensionsHost.Models;

namespace CcrlExtensionsHost.Services;

public partial class Engine
{
    private const int GracefulShutdownTime = 3_000;

    private readonly ILogger<Engine> _logger;

    private static readonly string[] _stringsToIgnore =
    [
        "lowerbound",
        "upperbound",
        "currmove"
    ];
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

        var success = TryUpdateEngineInfo(line);
    }

    [GeneratedRegex(" multipv (\\d+)", RegexOptions.Compiled)]
    private static partial Regex MultipvRegex();
    private readonly Regex _multipvRegex = MultipvRegex();

    [GeneratedRegex(" score cp (-?\\d+)", RegexOptions.Compiled)]
    private static partial Regex CpRegex();
    private readonly Regex _cpRegex = CpRegex();

    [GeneratedRegex(" score mate (-?\\d+)", RegexOptions.Compiled)]
    private static partial Regex MateRegex();
    private readonly Regex _mateRegex = MateRegex();

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

    private bool TryUpdateEngineInfo(string? line)
    {
        if (string.IsNullOrEmpty(line) || _stringsToIgnore.Any(line.Contains))
            return false;

        CurrentEngineInfo ??= new EngineInfo();

        if (!line.Contains("info"))
        {
            if (line.Contains("uciok"))
            {
                CurrentEngineInfo.Name = Config?.Name;
                return true;
            }
            return false;
        }

        int multipvNumber = 1;
        int depth = 0, cp = 0;
        long nodes = 0, nps = 0;
        string score = "0", pv = "";
        int orderKey = 0;

        // Default multipv number is 1
        var multipvMatch = _multipvRegex.Match(line);
        if (multipvMatch.Success && int.TryParse(multipvMatch.Groups[1].Value, out var multiPvNumberParsed))
        {
            multipvNumber = multiPvNumberParsed;
        }

        var mateMatch = _mateRegex.Match(line);
        if (mateMatch.Success && int.TryParse(mateMatch.Groups[1].Value, out var mateMoves))
        {
            orderKey = -(10000000 - mateMoves) * Math.Sign(mateMoves);
            if (_currentFen?.Contains(" b ") == true) mateMoves = -mateMoves;
            if (mateMoves < 0)
            {
                score = $"-M{-mateMoves}";
            }
            else
            {
                score = $"+M{mateMoves}";
            }
        }
        else
        {
            var cpMatch = _cpRegex.Match(line);
            if (cpMatch.Success && int.TryParse(cpMatch.Groups[1].Value, out var cpParsed))
            {
                cp = cpParsed;
                orderKey = -cp;
                if (_currentFen?.Contains(" b ") == true) cp = -cp;
                score = $"{((float)cp / 100).ToString(CultureInfo.InvariantCulture)}";
            }
        }

        var depthMatch = _depthRegex.Match(line);
        if (depthMatch.Success) int.TryParse(depthMatch.Groups[1].Value, out depth);

        var nodesMatch = _nodesRegex.Match(line);
        if (nodesMatch.Success) long.TryParse(nodesMatch.Groups[1].Value, out nodes);

        var npsMatch = _npsRegex.Match(line);
        if (npsMatch.Success) long.TryParse(npsMatch.Groups[1].Value, out nps);

        var pvMatch = _pvRegex.Match(line);
        if (pvMatch.Success) pv = pvMatch.Groups[1].Value;

        var existing = CurrentEngineInfo.Multipv.FirstOrDefault(m => m.Multipv == multipvNumber);
        if (existing != null)
        {
            existing.Depth = depth;
            existing.Score = score;
            existing.Pv = pv;
            existing.OrderKey = orderKey;
        }
        else
        {
            CurrentEngineInfo.Multipv.Add(new MultipvInfo { Multipv = multipvNumber, Depth = depth, Score = score, Pv = pv, OrderKey = orderKey });
        }

        if (multipvNumber == 1)
        {
            CurrentEngineInfo.Score = score;
            CurrentEngineInfo.Depth = depth;
            CurrentEngineInfo.Pv = pv;
        }

        CurrentEngineInfo.Nps = nps;
        CurrentEngineInfo.Nodes = nodes;
        CurrentEngineInfo.Name = Config?.Name;


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
            // Reset the EngineInfo struct
            CurrentEngineInfo?.Multipv.Clear();
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
