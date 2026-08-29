# Isolated LGPL boundary. 7-Zip-derived interface usage stays in this target.
# Do not statically link this module into Lumina.Win or lumina-shell.

set(LUMINA_7ZIP_SDK "${CMAKE_CURRENT_LIST_DIR}/../../third_party/7zip-26.02/sdk")

if(WIN32)
  add_library(lumina-7z-adapter SHARED
    src/adapter_api.cpp
    src/dll_loader.cpp
    src/pe_arch.cpp
    src/utf.cpp
    src/error_map.cpp
    src/input_stream.cpp
    src/callbacks.cpp
    src/archive_ops.cpp
  )
  target_compile_definitions(lumina-7z-adapter PRIVATE LUMINA_7Z_ADAPTER_EXPORTS WIN32_LEAN_AND_MEAN NOMINMAX)
  target_include_directories(lumina-7z-adapter
    PUBLIC include
    PRIVATE "${LUMINA_7ZIP_SDK}"
  )
  target_link_libraries(lumina-7z-adapter PRIVATE ole32 oleaut32)
  set_target_properties(lumina-7z-adapter PROPERTIES OUTPUT_NAME "lumina-7z-adapter")

  add_executable(lumina-7z-adapter-test src/adapter_test.cpp)
  target_include_directories(lumina-7z-adapter-test PRIVATE include)
  target_link_libraries(lumina-7z-adapter-test PRIVATE lumina-7z-adapter)
else()
  add_library(lumina-7z-adapter STATIC src/adapter_stub.cpp)
  target_include_directories(lumina-7z-adapter PUBLIC include)
endif()
