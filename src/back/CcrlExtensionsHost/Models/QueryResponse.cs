namespace CcrlExtensionsHost.Models;

public class QueryResponse
{
    public List<EngineInfo> EngineInfos { get; set; }

    public QueryResponse(List<EngineInfo> engineInfos)
    {
        EngineInfos = engineInfos;
    }
}
