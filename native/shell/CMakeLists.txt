add_library(lumina-shell SHARED src/explorer_command.cpp)
target_compile_definitions(lumina-shell PRIVATE UNICODE _UNICODE)

if(MSVC)
  target_compile_options(lumina-shell PRIVATE /W4 /permissive-)
endif()
