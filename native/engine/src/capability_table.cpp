#include "lumina/engine.hpp"

namespace lumina::engine {

std::vector<Capability> capabilities() {
  // Advertised here only as the planned facade. G3/G5 wire the owners.
  return {
      {"zip", true, true, "minizip-ng"},
      {"7z", true, true, "7z.dll"},
      {"tar", true, true, "libarchive"},
      {"tar.gz", true, true, "libarchive"},
      {"tar.xz", true, true, "libarchive"},
      {"tar.zst", true, true, "libarchive"},
      {"rar", false, true, "7z.dll"},
      {"iso", false, true, "libarchive"},
  };
}

} // namespace lumina::engine
