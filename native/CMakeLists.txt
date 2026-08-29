cmake_minimum_required(VERSION 3.28)
project(LuminaNative LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

option(LUMINA_ENABLE_CODECS "Link third-party codecs (Windows G5+)" OFF)

if(MSVC)
  cmake_policy(SET CMP0091 NEW)
  set(CMAKE_MSVC_RUNTIME_LIBRARY "MultiThreaded$<$<CONFIG:Debug>:Debug>DLL")
  add_compile_options(/utf-8 /W4 /permissive- /guard:cf)
  add_link_options(/DYNAMICBASE /NXCOMPAT)
endif()

if(NOT WIN32)
  message(WARNING "Lumina native engine requires Windows MSVC. native build = BLOCKED BY ENVIRONMENT")
endif()

add_subdirectory(7z-adapter)
add_subdirectory(engine)
add_subdirectory(shell)
add_subdirectory(preview)
add_subdirectory(bench-run)
