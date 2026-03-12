## MODIFIED Requirements

### Requirement: Agent execution via Pi SDK in-process
The system SHALL execute coding agents using the Pi SDK (`@mariozechner/pi-coding-agent`) directly in the Electron main process, without subprocess spawning or JSONL parsing.

#### Scenario: Agent session starts
- **WHEN** user initiates an agent session on a task
- **THEN** `createAgentSession()` is called with the task's worktree as `cwd`
- **AND** Kira tools (`updateTaskStatus`, `requestHumanReview`, `logToKanban`) are injected as `customTools`
- **AND** Kira skills are loaded from bundled markdown files
- **AND** the session ID and session file path are stored for resume capability

#### Scenario: Agent events stream to renderer
- **WHEN** an `AgentSessionEvent` is emitted by the Pi SDK
- **THEN** the event is forwarded to the renderer via IPC or HTTP WebSocket
- **AND** the event is rendered in the agent execution UI
- **AND** the event is POSTed to the cloud for persistence (if online)

#### Scenario: Agent session is steered
- **WHEN** user sends a steering message to an active session
- **THEN** `session.steer(message)` is called directly
- **AND** the agent incorporates the guidance

#### Scenario: Agent session is aborted
- **WHEN** user aborts an active session
- **THEN** `session.abort()` is called directly
- **AND** the session terminates
- **AND** the task status is updated to `interrupted`

#### Scenario: Agent session resumes
- **WHEN** user starts a follow-up on a previous session
- **THEN** the stored `sessionFile` is passed to `session.switchSession()`
- **AND** the agent continues with previous context

### Requirement: Kira extension tools
The system SHALL provide Kira-specific tools that integrate with the task management system.

#### Scenario: updateTaskStatus tool
- **WHEN** the agent calls `updateTaskStatus` with a new status
- **THEN** the task status is updated in the local database
- **AND** the status change is synced to the cloud via ElectricSQL

#### Scenario: requestHumanReview tool
- **WHEN** the agent calls `requestHumanReview` with a message
- **THEN** a notification is shown to the user
- **AND** the task is marked as awaiting review
- **AND** the agent pauses until the user responds

#### Scenario: logToKanban tool
- **WHEN** the agent calls `logToKanban` with a message
- **THEN** the message is added to the task's activity log
- **AND** the log entry is visible in both local and remote UIs

### Requirement: LiteLLM proxy integration
The system SHALL use the Kira-hosted LiteLLM proxy for LLM access when available, falling back to user credentials.

#### Scenario: Proxy key is used
- **WHEN** a session starts and a LiteLLM proxy key is available
- **THEN** the key is registered as a runtime Anthropic provider override
- **AND** all LLM calls go through the proxy

#### Scenario: Fallback to user credentials
- **WHEN** no proxy key is available
- **THEN** the user's stored Pi credentials are used
- **AND** if no credentials exist, the user is prompted to configure an API key