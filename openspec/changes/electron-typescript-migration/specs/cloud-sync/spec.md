## MODIFIED Requirements

### Requirement: ElectricSQL sync for kanban data
The system SHALL sync kanban data (issues, projects, tags, comments, assignees, etc.) between the Electron app and cloud via ElectricSQL shapes.

#### Scenario: Issue is created locally
- **WHEN** a user creates an issue in the Electron app
- **THEN** the issue is written to the cloud API
- **AND** the `txid` is returned
- **AND** the issue appears in the ElectricSQL shape stream
- **AND** the issue is visible in remote-web

#### Scenario: Issue is updated in remote-web
- **WHEN** a team member updates an issue in remote-web
- **THEN** the change is written to the cloud API
- **AND** the change propagates via ElectricSQL
- **AND** the Electron app receives the update
- **AND** the local UI reflects the change

#### Scenario: Offline operation
- **WHEN** the Electron app is offline
- **THEN** the app continues to function with local data
- **AND** ElectricSQL sync resumes when online
- **AND** conflicts are resolved by last-write-wins or explicit resolution

### Requirement: Agent event push to cloud
The system SHALL push agent events from the Electron app to the cloud for persistence and team visibility.

#### Scenario: Events are pushed in real-time
- **WHEN** an agent session emits events
- **THEN** events are POSTed to `/v1/internal/tasks/:id/events`
- **AND** events are persisted in the `task_events` table
- **AND** events are fanned out to remote-web subscribers

#### Scenario: Events are buffered when offline
- **WHEN** the Electron app is offline during a session
- **THEN** events are buffered in memory (bounded, last 1000 per session)
- **AND** buffered events are pushed when online
- **AND** local operation is not blocked by cloud availability

### Requirement: Cloud authentication for sync
The system SHALL authenticate the Electron app with the cloud for sync operations.

#### Scenario: App authenticates with Keycloak
- **WHEN** the Electron app needs to sync
- **THEN** the user is prompted to log in via Keycloak (if not already)
- **AND** a JWT is obtained and stored
- **AND** the JWT is used for all cloud API requests

#### Scenario: JWT is refreshed
- **WHEN** the JWT is near expiration
- **THEN** a refresh token is used to obtain a new JWT
- **AND** sync continues uninterrupted