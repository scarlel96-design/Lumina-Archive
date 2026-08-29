set(LUMINA_THIRD_PARTY "${CMAKE_CURRENT_LIST_DIR}/../../third_party")

add_executable(lumina-engine
  src/main.cpp
  src/capability_table.cpp
  src/ipc/framing.cpp
  src/ipc/protocol.cpp
  src/ipc/named_pipe_client.cpp
  src/ipc/secret_pipe_client.cpp
  src/ipc/worker_loop.cpp
)
target_include_directories(lumina-engine PRIVATE include src "${LUMINA_THIRD_PARTY}")

add_executable(lumina-ipc-parse-test
  src/ipc/protocol.cpp
  src/ipc/protocol_test.cpp
)
target_include_directories(lumina-ipc-parse-test PRIVATE include src "${LUMINA_THIRD_PARTY}")

# Codecs load only inside this process, and only after G3/G5 pin hashes exist.
if(LUMINA_ENABLE_CODECS)
  message(FATAL_ERROR "G0 forbids codec enablement. Flip this in G3/G5 after pins hash.")
endif()
