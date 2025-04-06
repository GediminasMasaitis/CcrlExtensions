namespace CcrlExtensionsHost.Models;

public class EngineInfo
{
    public string? Name { get; set; }
    public string? Score { get; set; }
    public int Depth { get; set; }
    public long Nodes { get; set; }
    public long Nps { get; set; }
    public string? Pv { get; set; }

    // Multipv
    public List<MultipvInfo> Multipv { get; set; } = [];
}
