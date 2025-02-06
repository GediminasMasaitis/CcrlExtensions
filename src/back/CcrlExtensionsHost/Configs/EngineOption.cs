using System.ComponentModel.DataAnnotations;

namespace CcrlExtensionsHost.Configs;

public sealed record EngineOption
{
    [Required] // https://github.com/dotnet/runtime/issues/101984
    public string Name { get; set; } = null!;
    [Required]
    public string Value { get; set; } = null!;
}