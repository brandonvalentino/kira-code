## MODIFIED Requirements

### Requirement: SQLite persistence in Electron main process
The system SHALL persist local data (sessions, worktrees, settings, scratch) in a SQLite database managed by the Electron main process using better-sqlite3.

#### Scenario: Database is initialized on first launch
- **WHEN** the Electron app launches for the first time
- **THEN** a SQLite database is created at the appropriate platform-specific location
- **AND** all required tables are created via migrations

#### Scenario: Session is persisted
- **WHEN** an agent session is created
- **THEN** a record is inserted into the `sessions` table
- **AND** the session status is updated as it progresses

#### Scenario: Worktree is persisted
- **WHEN** a worktree is created for a session
- **THEN** a record is inserted into the `worktrees` table
- **AND** the worktree path is stored for later reference

#### Scenario: Settings are persisted
- **WHEN** a setting is changed
- **THEN** the setting is upserted into the `settings` table
- **AND** the setting is available on next launch

#### Scenario: Scratch notes are persisted
- **WHEN** a scratch note is created or updated
- **THEN** the note is persisted in the `scratch` table
- **AND** notes are available across app restarts

### Requirement: Local data is NOT synced to cloud
The system SHALL NOT sync local SQLite data (sessions, worktrees, settings, scratch) to the cloud. Only kanban data (issues, projects, tags) syncs via ElectricSQL.

#### Scenario: Session data stays local
- **WHEN** an agent session is created
- **THEN** the session record exists only in local SQLite
- **AND** the session is not visible in remote-web

#### Scenario: Worktree paths stay local
- **WHEN** a worktree is created
- **THEN** the absolute path is stored locally
- **AND** the path is not synced to cloud

### Requirement: Database migrations
The system SHALL support database migrations for schema evolution.

#### Scenario: Migrations run on app update
- **WHEN** the Electron app is updated with new migrations
- **THEN** migrations are applied on next launch
- **AND** the database schema is updated
- **AND** existing data is preserved