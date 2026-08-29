set(LUMINA_THIRD_PARTY "${CMAKE_CURRENT_LIST_DIR}/../../third_party")

add_executable(lumina-engine
  src/main.cpp
  src/capability_table.cpp
  src/g3_job.cpp
  src/ipc/framing.cpp
  src/ipc/protocol.cpp
  src/ipc/named_pipe_client.cpp
  src/ipc/secret_pipe_client.cpp
  src/ipc/worker_loop.cpp
)
target_include_directories(lumina-engine PRIVATE
  include
  src
  "${LUMINA_THIRD_PARTY}"
  "${CMAKE_CURRENT_LIST_DIR}/../7z-adapter/include"
)

add_executable(lumina-ipc-parse-test
  src/ipc/protocol.cpp
  src/ipc/protocol_test.cpp
)
target_include_directories(lumina-ipc-parse-test PRIVATE include src "${LUMINA_THIRD_PARTY}")

# G5 codecs stay off. G3 uses LUMINA_ENABLE_7ZIP_RUNTIME (dynamic official DLL via adapter).
if(LUMINA_ENABLE_CODECS)
  message(FATAL_ERROR "G0 forbids codec enablement. Flip this in G5 after pins hash. G3 uses LUMINA_ENABLE_7ZIP_RUNTIME only.")
endif()

if(WIN32)
  add_dependencies(lumina-engine lumina-7z-adapter)
  add_custom_command(TARGET lumina-engine POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_if_different
      $<TARGET_FILE:lumina-7z-adapter>
      $<TARGET_FILE_DIR:lumina-engine>
  )
endif()
