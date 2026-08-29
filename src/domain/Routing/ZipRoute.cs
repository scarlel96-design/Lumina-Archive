namespace Lumina.Domain.Routing;

public enum ZipCreatePath
{
    ZlibNg,
    IsaL,
    LibDeflate,
    Store,
    MinizipCapability,
    SevenZipFallback
}

public static class ZipRouter
{
    // Policy only. Codec selection happens in the engine after CPU detection.
    public static ZipCreatePath ChooseCreate(bool x64, bool isaL, bool fastPreset, bool lowEntropy)
    {
        if (lowEntropy) return ZipCreatePath.Store;
        if (fastPreset && x64 && isaL) return ZipCreatePath.IsaL;
        if (fastPreset) return ZipCreatePath.ZlibNg;
        return ZipCreatePath.ZlibNg;
    }
}
