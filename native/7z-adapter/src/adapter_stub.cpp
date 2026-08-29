#include "lumina/seven_zip_adapter.hpp"

namespace lumina::sevenzip {

bool load_official_dll() {
  // G3: LoadLibraryW of redistributed 7z.dll + CreateObject.
  return false;
}

}
