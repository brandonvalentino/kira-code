## ADDED Requirements

### Requirement: Extension package structure and registration
The system SHALL provide a TypeScript npm package (`@kira-code/pi-extension`) that exports a valid Pi extension definition, installable via `pi --extension @kira-code/pi-extension`.

#### Scenario: Extension loads without error
- **WHEN** `pi --mode rpc --extension @kira-code/pi-extension` is invoked
- **THEN** the Pi process starts successfully and the three Kira tools appear in the agent's available tool list

#### Scenario: Extension authenticates with the Kira API
- **WHEN** the extension initialises, it reads `KIRA_API_URL` and `KIRA_EXTENSION_TOKEN` from environment variables
- **THEN** all outbound Kira API calls include `Authorization: Bearer <token>` and target the configured base URL

### Requirement: update_task_status tool
The system SHALL implement an `update_task_status` tool that allows the agent to mark a Kira task as `in_progress`, `done`, or `blocked`.

#### Scenario: Agent calls update_task_status with valid status
- **WHEN** the agent invokes `update_task_status({ task_id: "abc123", status: "done", message: "Tests passing" })`
- **THEN** the extension issues a `PATCH /api/tasks/abc123` request to the Kira API and the task's status is updated in the database

#### Scenario: Agent calls update_task_status with invalid status
- **WHEN** the agent invokes `update_task_status` with a `status` value not in `["in_progress", "done", "blocked"]`
- **THEN** the tool returns an error result describing the allowed values without making a network request

#### Scenario: Kira API is unreachable
- **WHEN** the `PATCH /api/tasks/{id}` call fails due to a network error or non-2xx response
- **THEN** the tool returns a descriptive error result and the agent can decide how to proceed

### Requirement: request_human_review tool
The system SHALL implement a `request_human_review` tool that pauses agent execution and signals to the Kira UI that human input is needed.

#### Scenario: Agent requests review
- **WHEN** the agent invokes `request_human_review({ reason: "Ambiguous requirement in task 5" })`
- **THEN** the extension posts a `review_requested` event to the Kira API, which triggers a UI notification to the assigned human reviewer, and the tool returns a pending status to the agent

#### Scenario: Human approves the review
- **WHEN** the human reviewer clicks "Approve" in the Kira UI
- **THEN** the Kira API resolves the pending review, and the tool call unblocks with a result indicating approval and any reviewer comments

#### Scenario: Review times out
- **WHEN** no human action is taken within the configured timeout (default: 30 minutes)
- **THEN** the tool returns a timeout error result so the agent can escalate or abort

### Requirement: log_to_kanban tool
The system SHALL implement a `log_to_kanban` tool that allows the agent to post a structured message to the Kira task's activity log.

#### Scenario: Agent logs a message
- **WHEN** the agent invokes `log_to_kanban({ task_id: "abc123", level: "info", message: "Completed database migration" })`
- **THEN** a log entry is created in the Kira database and appears in the task's activity feed in the UI

#### Scenario: log_to_kanban with invalid log level
- **WHEN** the agent invokes `log_to_kanban` with a `level` value not in `["info", "warn", "error"]`
- **THEN** the tool returns a validation error without creating a log entry
