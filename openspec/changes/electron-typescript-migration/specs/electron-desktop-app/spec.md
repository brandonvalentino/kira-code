## ADDED Requirements

### Requirement: Electron app launches and serves local UI
The system SHALL provide an Electron desktop application that launches a local HTTP server and renders the local-web React application in a BrowserWindow.

#### Scenario: App launches successfully
- **WHEN** user opens the Electron app
- **THEN** the main process starts an HTTP server on localhost
- **AND** a BrowserWindow opens displaying the local-web React app
- **AND** the app appears in the system tray

#### Scenario: App runs in background when window closed
- **WHEN** user closes the BrowserWindow
- **THEN** the app continues running in the system tray
- **AND** any active agent sessions continue uninterrupted
- **AND** clicking the system tray icon reopens the window

### Requirement: System tray integration
The system SHALL provide a system tray icon with status indicator and quick actions.

#### Scenario: System tray shows app status
- **WHEN** the app is running
- **THEN** a system tray icon is visible
- **AND** the icon indicates current status (idle, running, error)
- **AND** right-clicking shows a context menu with "Open", "Quit" options

#### Scenario: System tray notification on agent completion
- **WHEN** an agent session completes
- **THEN** a system notification is shown
- **AND** clicking the notification opens the app window

### Requirement: Auto-update functionality
The system SHALL support automatic updates via electron-updater with delta updates.

#### Scenario: Update available notification
- **WHEN** a new version is available
- **THEN** a notification is shown to the user
- **AND** the user can choose to update now or later

#### Scenario: Update downloads and installs
- **WHEN** user accepts an update
- **THEN** the update downloads in the background
- **AND** the user is prompted to restart when ready
- **AND** the app restarts with the new version

### Requirement: Deep link support
The system SHALL register a custom URL scheme (`kira-code://`) for deep linking from browsers and external apps.

#### Scenario: Deep link opens specific task
- **WHEN** user clicks a `kira-code://task/abc123` link
- **THEN** the Electron app opens (or focuses if already running)
- **AND** navigates to the specified task

### Requirement: Native file associations
The system SHALL optionally register file associations for opening repositories directly in Kira Code.

#### Scenario: Open folder from file manager
- **WHEN** user right-clicks a folder and selects "Open with Kira Code"
- **THEN** the Electron app opens with that folder as the workspace

### Requirement: Single binary distribution
The system SHALL be distributed as platform-native installers (.dmg, .exe, .AppImage, .deb) with all dependencies bundled.

#### Scenario: macOS installation
- **WHEN** user downloads and opens the .dmg file
- **THEN** the app can be dragged to Applications
- **AND** the app launches without additional dependencies

#### Scenario: Windows installation
- **WHEN** user runs the .exe installer
- **THEN** the app is installed to Program Files
- **AND** Start Menu and Desktop shortcuts are created

### Requirement: Pi SDK in-process execution
The system SHALL run the Pi Coding Agent SDK (`@mariozechner/pi-coding-agent`) directly in the Electron main process without subprocess spawning.

#### Scenario: Agent session starts in-process
- **WHEN** user starts an agent session
- **THEN** `createAgentSession()` is called directly in the main process
- **AND** no subprocess is spawned
- **AND** typed `AgentSessionEvent` objects are emitted directly

#### Scenario: Agent session steers in-process
- **WHEN** user sends a steering message to an active session
- **THEN** `session.steer(message)` is called directly
- **AND** no IPC bridge is required for the call

#### Scenario: Agent session aborts in-process
- **WHEN** user aborts an active session
- **THEN** `session.abort()` is called directly
- **AND** the session terminates immediately