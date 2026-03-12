## MODIFIED Requirements

### Requirement: Kanban board with full CRUD
The system SHALL provide a kanban board in remote-web with full create, read, update, delete operations for issues, projects, and tags.

#### Scenario: User creates an issue
- **WHEN** a user creates an issue in remote-web
- **THEN** the issue is created via the cloud API
- **AND** the issue appears in the kanban board
- **AND** the issue is synced to all connected clients via ElectricSQL

#### Scenario: User moves an issue between columns
- **WHEN** a user drags an issue to a different column
- **THEN** the issue's status is updated
- **AND** the change is persisted and synced

#### Scenario: User assigns an issue
- **WHEN** a user assigns an issue to a team member
- **THEN** the assignment is recorded
- **AND** the assignee receives a notification

### Requirement: Agent run history viewer (read-only)
The system SHALL provide a read-only viewer for agent run history in remote-web, showing stored events from completed sessions.

#### Scenario: User views task history
- **WHEN** a user opens a task in remote-web
- **THEN** the agent run history is displayed
- **AND** thinking blocks, tool calls, and diffs are rendered
- **AND** the user cannot start, steer, or abort sessions

#### Scenario: User views live session
- **WHEN** a session is actively running on a team member's machine
- **THEN** events are streamed in real-time via WebSocket
- **AND** the user can watch progress
- **AND** the user cannot interact with the session

### Requirement: Team and organization management
The system SHALL provide team and organization management in remote-web.

#### Scenario: User invites team member
- **WHEN** an admin invites a new team member
- **THEN** an invitation email is sent
- **AND** the invitee can join the organization

#### Scenario: User manages project settings
- **WHEN** a project admin changes project settings
- **THEN** the settings are persisted
- **AND** changes are reflected for all team members

### Requirement: No local-only features in remote-web
The system SHALL NOT expose local-only features (workspace, terminal, file tree, scratch, live agent execution) in remote-web.

#### Scenario: User cannot access workspace
- **WHEN** a user views a task in remote-web
- **THEN** no workspace or file tree is shown
- **AND** no terminal is available
- **AND** no "Start Agent" button is present

#### Scenario: User cannot start agent
- **WHEN** a user views a task in remote-web
- **THEN** only the agent run history is visible
- **AND** the user cannot start a new session