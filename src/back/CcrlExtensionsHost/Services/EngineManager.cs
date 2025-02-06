using Microsoft.Extensions.Options;
using CcrlExtensionsHost.Configs;
using CcrlExtensionsHost.Models;

namespace CcrlExtensionsHost.Services;

public class EngineManager
{
    private readonly IServiceProvider _provider;
    private readonly ServiceConfig _config;

    private readonly List<Task> _engineTasks;

    public List<Engine> Engines { get; }

    public EngineManager(IServiceProvider provider, IOptions<ServiceConfig> config)
    {
        _provider = provider;
        _config = config.Value;

        Engines = new List<Engine>(_config.Engines.Count);
        _engineTasks = new List<Task>(_config.Engines.Count);
    }

    public void Start()
    {
        foreach (var engineConfig in _config.Engines)
        {
            var engine = _provider.GetRequiredService<Engine>();
            var engineTask = engine.RunAsync(engineConfig);
            Engines.Add(engine);
            _engineTasks.Add(engineTask);
        }
    }

    public async Task StopAsync()
    {
        var shutDownTasks = Engines.Select(e => e.ShutDown());

        await Task.WhenAll(shutDownTasks);
    }

    public async Task SetFenAsync(string fen)
    {
        foreach (var engine in Engines)
        {
            await engine.SetFenAsync(fen);
        }
    }

    public List<EngineInfo> GetCurrentInfos()
    {
        var infos = new List<EngineInfo>(Engines.Count);
        foreach (Engine engine in Engines)
        {
            if (engine.CurrentEngineInfo is not null)
            {
                infos.Add(engine.CurrentEngineInfo);
            }
        }
        return infos;
    }
}
