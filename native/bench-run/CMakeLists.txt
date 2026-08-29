# G1 physical-runner helper only. Not shipped as the product. No codecs.
if(WIN32)
  add_executable(lumina-bench-run src/main.cpp)
  target_compile_definitions(lumina-bench-run PRIVATE UNICODE _UNICODE)
  target_link_libraries(lumina-bench-run PRIVATE psapi)
endif()
