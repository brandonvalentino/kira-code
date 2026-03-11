## ADDED Requirements

### Requirement: Kira manages the Pi binary silently as a bundled service
The system SHALL bundle the `pi` binary inside the platform-specific Kira download artifact (same zip as `kira-code` and `kira-code-mcp`) and extract it to `~/.kira/bin/pi` via the existing `ensureBinary` mechanism in `npx-cli/bin/download.js`. Users SHALL NOT need to install, update, or configure `pi` manually.

#### Scenario: First launch — Pi binary not yet present
- **WHEN** a user runs `npx kira-code` for the first time
- **THEN** `download.js` downloads the Kira artifact (which includes `pi`), extracts `~/.kira/bin/pi`, and the binary is executable before the Rust backend starts

#### Scenario: Pi version mismatch detected at startup
- **WHEN** the Rust backend starts and `~/.kira/bin/pi --version` returns a version different from the expected bundled version
- **THEN** the backend logs a warning and triggers a re-download of the artifact to restore the correct version

#### Scenario: Pi binary is corrupt or missing after install
- **WHEN** `~/.kira/bin/pi` exists but fails to execute (e.g., corrupted file)
- **THEN** the backend logs an error and surfaces a clear user-facing message directing them to run `npx kira-code@latest` to repair

#### Scenario: `PiExecutor` uses managed path, not PATH
- **WHEN** `PiExecutor::spawn()` is called
- **THEN** it resolves the `pi` binary from `~/.kira/bin/pi` (or the configured `KIRA_PI_BIN` env var override) and does NOT search `PATH`

### Requirement: PiExecutor spawns and manages the Pi RPC process
The system SHALL implement a `PiExecutor` struct in `crates/executors/src/executors/pi.rs` that spawns the `pi` binary with `--mode rpc` and manages its full lifecycle (start, stream, stop, kill).

#### Scenario: Successful process spawn
- **WHEN** `PiExecutor::spawn()` is called with a task prompt and execution environment
- **THEN** a `pi --mode rpc` child process is started with the correct working directory, environment variables, and optional `--extension` flag

#### Scenario: Process fails to start (binary not found)
- **WHEN** the `pi` binary is not present on `PATH` or at the configured path
- **THEN** `PiExecutor::spawn()` returns an `ExecutorError::BinaryNotFound` error with a descriptive message

#### Scenario: Process exits unexpectedly
- **WHEN** the `pi` process exits with a non-zero status code before sending a `complete` event
- **THEN** the executor emits an `ExecutorEvent::Error` containing the exit code and captured stderr, then closes the event stream

### Requirement: PiExecutor parses JSONL events from Pi stdout
The system SHALL deserialize each newline-delimited JSON line from `pi` stdout into a typed `PiEvent` enum and emit it on the executor's event stream.

#### Scenario: Thinking block received
- **WHEN** Pi emits a `{"type":"thinking","content":"..."}` JSONL line
- **THEN** the executor emits `PiEvent::Thinking { content: String }` on the stream

#### Scenario: Tool call received
- **WHEN** Pi emits a `{"type":"tool_call","name":"...","input":{...}}` JSONL line
- **THEN** the executor emits `PiEvent::ToolCall { name: String, input: serde_json::Value }` on the stream

#### Scenario: File edit received
- **WHEN** Pi emits a `{"type":"edit","path":"...","diff":"..."}` JSONL line
- **THEN** the executor emits `PiEvent::Edit { path: String, diff: String }` on the stream

#### Scenario: Progress update received
- **WHEN** Pi emits a `{"type":"progress","message":"..."}` JSONL line
- **THEN** the executor emits `PiEvent::Progress { message: String }` on the stream

#### Scenario: Completion received
- **WHEN** Pi emits a `{"type":"complete","summary":"..."}` JSONL line
- **THEN** the executor emits `PiEvent::Complete { summary: String }` and closes the stream gracefully

#### Scenario: Malformed JSONL line
- **WHEN** Pi emits a line that is not valid JSON or does not match any known event type
- **THEN** the executor emits `PiEvent::Unknown { raw: String }` and continues processing subsequent lines without crashing

### Requirement: PiExecutor supports steering via stdin
The system SHALL allow the caller to send a steering message to the running `pi` process by writing a JSONL `{"type":"steer","message":"..."}` line to the process's stdin.

#### Scenario: Steering message delivered
- **WHEN** `PiExecutor::steer(message)` is called while the process is running
- **THEN** a `{"type":"steer","message":"<message>"}` JSONL line is written to the process's stdin within 100 ms

#### Scenario: Steering on a dead process
- **WHEN** `PiExecutor::steer(message)` is called after the process has exited
- **THEN** the call returns `ExecutorError::ProcessNotRunning` without panicking

### Requirement: Legacy executor modules are removed
The system SHALL delete all executor modules in `crates/executors/src/executors/` that are not `pi.rs`, `mod.rs`, or `utils.rs`, and remove corresponding variants from the `CodingAgent` enum.

#### Scenario: Build succeeds after deletion
- **WHEN** the legacy executor modules (amp, claude, codex, copilot, cursor, droid, gemini, opencode, qwen) are deleted and `CodingAgent` is updated
- **THEN** `cargo build --workspace` succeeds without errors

#### Scenario: API returns error for legacy agent type
- **WHEN** a stored record references a legacy `CodingAgent` variant that no longer exists
- **THEN** deserialization falls back gracefully (e.g., returns `CodingAgent::Pi` with a warning log) rather than panicking

### Requirement: Pi events are streamed to the frontend via SSE/WebSocket
The system SHALL forward `PiEvent` values from the executor stream to connected frontend clients using the existing server-sent events (SSE) or WebSocket infrastructure in `crates/server` and `crates/remote`.

#### Scenario: Thinking event delivered to UI
- **WHEN** `PiEvent::Thinking` is emitted by the executor
- **THEN** a corresponding SSE/WebSocket message is pushed to all subscribed frontend clients within 200 ms

#### Scenario: Client reconnects during streaming
- **WHEN** a frontend client disconnects and reconnects while the `pi` process is still running
- **THEN** the client receives subsequent events from the point of reconnection without causing the process to terminate
