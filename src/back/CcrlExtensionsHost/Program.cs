using CcrlExtensionsHost.Services;
using CcrlExtensionsHost.Models;
using Microsoft.AspNetCore.Mvc;
using CcrlExtensionsHost;

var builder = WebApplication.CreateBuilder(args);

#pragma warning disable S1075 // URIs should not be hardcoded - FE script relies on this hardcoded port
builder.WebHost.UseUrls("http://127.0.0.1:5210");
#pragma warning restore S1075 // URIs should not be hardcoded

builder.Logging.ConfigureSerilog(builder.Configuration);
builder.Services.AddCcrlExtensions(builder.Configuration);

var app = builder.Build();

app.MapGet("/query",
    (EngineManager engineManager) => new QueryResponse(engineManager.GetCurrentInfos()));

app.MapPost("/fen",
    async ([FromBody] FenRequest request, EngineManager engineManager, ILogger<Program> logger) =>
    {
        logger.LogInformation("FEN: {Fen}", request.Fen);
        await engineManager.SetFenAsync(request.Fen);

        return new FenResponse(engineManager.Engines.ConvertAll(x => x.Config));
    });

bool hostShutdown = false;

AppDomain.CurrentDomain.ProcessExit += async (e, a) =>
{
    if (!hostShutdown)
    {
        await app.Services.GetRequiredService<EngineManager>().StopAsync();
    }
};

await app.RunAsync();

hostShutdown = true;
