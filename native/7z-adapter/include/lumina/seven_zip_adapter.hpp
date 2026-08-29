#pragma once
// Loads official unmodified 7z.dll in the engine process (G3).
// No password parameters. Crypto uses ICryptoGetTextPassword callback.

namespace lumina::sevenzip {

bool load_official_dll();

}
