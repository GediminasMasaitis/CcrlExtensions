using System.Text.Json.Serialization;
using CcrlExtensionsHost.Models;

namespace CcrlExtensionsHost;

[JsonSerializable(typeof(QueryResponse))]
[JsonSerializable(typeof(EngineInfo))]
[JsonSerializable(typeof(FenRequest))]
[JsonSerializable(typeof(FenResponse))]
internal partial class CcrlExtensionsHostJsonSerializerContext : JsonSerializerContext;
