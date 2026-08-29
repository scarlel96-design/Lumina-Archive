# Isolated LGPL boundary. If this directory ever contains 7-Zip-derived
# sources, THIS TARGET is LGPL. Do not statically link it into Lumina.Win.
add_library(lumina-7z-adapter STATIC src/adapter_stub.cpp)
target_include_directories(lumina-7z-adapter PUBLIC include)
