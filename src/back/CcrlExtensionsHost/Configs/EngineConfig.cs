using System.ComponentModel.DataAnnotations;

namespace CcrlExtensionsHost.Configs;

public sealed record EngineConfig
{
    [Required] // https://github.com/dotnet/runtime/issues/101984
    public string Name { get; set; } = null!;
    [Required]
    public string Path { get; set; } = null!;
    public IList<EngineOption> Options { get; set; } = new List<EngineOption>();
}