#include "lumina/engine.hpp"

#include <iostream>

int main(int argc, char** argv) {
  // Invariant: never read passwords from argv or environment.
  (void)argc;
  (void)argv;
  std::cerr << "lumina-engine G0 skeleton\n";
  std::cerr << "native codecs not linked (LUMINA_ENABLE_CODECS=OFF)\n";
  for (const auto& cap : lumina::engine::capabilities()) {
    std::cerr << "  cap " << cap.format << " create=" << cap.create
              << " extract=" << cap.extract << " owner=" << cap.owner << "\n";
  }
  return lumina::engine::run_worker();
}
