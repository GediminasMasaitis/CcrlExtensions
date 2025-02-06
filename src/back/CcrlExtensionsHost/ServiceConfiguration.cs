using CcrlExtensionsHost.Configs;
using CcrlExtensionsHost.Services;
using Serilog;
using Serilog.Events;
using Serilog.Core;

namespace CcrlExtensionsHost;

public static class ServiceConfiguration
{
    public static IServiceCollection AddCcrlExtensions(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ServiceConfig>(configuration);

        services.ConfigureHttpJsonOptions(options =>
            options.SerializerOptions.TypeInfoResolverChain.Add(CcrlExtensionsHostJsonSerializerContext.Default));

        services.AddSingleton<EngineManager>();
        services.AddTransient<Engine>();

        services.AddHostedService<EnginesHostedService>();

        return services;
    }

    public static ILoggingBuilder ConfigureSerilog(this ILoggingBuilder loggingBuilder, IConfiguration configuration)
    {
        return loggingBuilder
            .ClearProviders()
            .AddSerilog(CreateLogger(configuration));
    }

    private static Logger CreateLogger(IConfiguration configuration)
    {
        var loggerConfiguration = new LoggerConfiguration()
            .Enrich.FromLogContext()
            .WriteTo.Console()
            .MinimumLevel.Debug()
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .ReadFrom.Configuration(configuration);

        return loggerConfiguration.CreateLogger();
    }
}
