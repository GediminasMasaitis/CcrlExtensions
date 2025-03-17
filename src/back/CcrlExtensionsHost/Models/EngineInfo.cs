public class MultipvInfo
{
    public int Multipv { get; set; }
    public string? Score { get; set; }
    public int Depth { get; set; }
    public string? Pv { get; set; }
}

public class EngineInfo
{
    // It is a bit redundant yes, but i dont want to change too much stuff.
    public string? Name { get; set; }
    public string? Score { get; set; }
    public int Depth { get; set; }
    public long Nodes { get; set; }
    public long Nps { get; set; }
    public string? Pv { get; set; }

    // Multipv
    public List<MultipvInfo> Multipv { get; set; } = [];
}
