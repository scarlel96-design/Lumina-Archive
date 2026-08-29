// lumina-shell.dll — IExplorerCommand stub.
// INVARIANT: this module must never load compression libraries or image
// decoders. It only launches Lumina.Win with selected paths.

#if defined(_WIN32)
#  define WIN32_LEAN_AND_MEAN
#  include <windows.h>

BOOL APIENTRY DllMain(HMODULE, DWORD, LPVOID) { return TRUE; }

// G8 implements IExplorerCommand. G0 only proves the module boundary exists.
extern "C" __declspec(dllexport) const char* LuminaShellIdentify() {
  return "lumina-shell G0 — no parser loaded";
}
#else
extern "C" const char* LuminaShellIdentify() {
  return "lumina-shell G0 — Windows only";
}
#endif
