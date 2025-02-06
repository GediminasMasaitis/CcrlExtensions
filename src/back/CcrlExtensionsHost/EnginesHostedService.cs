using CcrlExtensionsHost.Services;

namespace CcrlExtensionsHost;

internal class EnginesHostedService : IHostedService
{
    private readonly ILogger _logger;
    private readonly EngineManager _engineManager;

    public EnginesHostedService(ILogger<EnginesHostedService> logger, EngineManager engineManager)
    {
        _engineManager = engineManager;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Starting engines");

        _engineManager.Start();

        return Task.CompletedTask;
    }

    public async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("Stopping engines");

        await _engineManager.StopAsync();
    }
}
