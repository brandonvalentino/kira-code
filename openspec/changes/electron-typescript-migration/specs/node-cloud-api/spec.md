## ADDED Requirements

### Requirement: Node.js HTTP API server
The system SHALL provide a Node.js HTTP API server using Hono that replaces the existing Rust `crates/remote` server.

#### Scenario: API server starts successfully
- **WHEN** the cloud-api service starts
- **THEN** an HTTP server listens on the configured port
- **AND** all REST endpoints are available
- **AND** the ElectricSQL proxy is functional

#### Scenario: API handles CRUD requests
- **WHEN** a client makes a REST API request (e.g., `POST /v1/issues`)
- **THEN** the request is authenticated via Keycloak JWT
- **AND** the request is authorized for the user's organization
- **AND** the database operation is performed
- **AND** a `MutationResponse` with `txid` is returned

### Requirement: ElectricSQL proxy integration
The system SHALL proxy ElectricSQL shape requests with authentication and authorization.

#### Scenario: Shape request is authenticated
- **WHEN** a client requests a shape via `/shape/*`
- **THEN** the request is authenticated via Keycloak JWT
- **AND** organization/project membership is verified
- **AND** the request is forwarded to ElectricSQL with appropriate parameters

### Requirement: Agent event persistence
The system SHALL accept and persist agent events from Electron apps for team visibility and history.

#### Scenario: Agent events are persisted
- **WHEN** an Electron app POSTs events to `/v1/internal/tasks/:id/events`
- **THEN** the request is authenticated via internal secret
- **AND** events are stored in the `task_events` table
- **AND** events are fanned out to connected remote-web clients via WebSocket

#### Scenario: Agent events are retrieved for history
- **WHEN** a remote-web client requests task history via WebSocket
- **THEN** stored events are streamed to the client
- **AND** live events are streamed as they arrive

### Requirement: Keycloak OAuth integration
The system SHALL use Keycloak as the sole OAuth provider for user authentication.

#### Scenario: User logs in via Keycloak
- **WHEN** a user initiates login
- **THEN** they are redirected to Keycloak
- **AND** upon successful authentication, a JWT is issued
- **AND** the user is redirected back to the application

#### Scenario: API validates Keycloak JWT
- **WHEN** a request includes a Keycloak JWT
- **THEN** the JWT is validated against Keycloak's public key
- **AND** the user identity is extracted
- **AND** the request proceeds with the user context

### Requirement: LiteLLM proxy token management
The system SHALL issue short-lived LiteLLM proxy keys to authenticated users for LLM access.

#### Scenario: User requests LLM proxy token
- **WHEN** an authenticated user requests `GET /v1/user/llm-token`
- **THEN** a short-lived proxy key is fetched from LiteLLM admin API
- **AND** the key and proxy URL are returned to the client

### Requirement: TypeScript-native type system
The system SHALL use native TypeScript types throughout with no external type generation.

#### Scenario: Types are shared with clients
- **WHEN** a new type is defined in `packages/shared/`
- **THEN** it is immediately usable in both cloud-api and Electron app
- **AND** no type generation step is required
- **AND** type changes are reflected at compile time

### Requirement: Internal server-to-server authentication
The system SHALL authenticate internal requests from Electron apps using a shared secret.

#### Scenario: Internal event push is authenticated
- **WHEN** an Electron app POSTs events to `/v1/internal/*`
- **THEN** the request includes `Authorization: Bearer <KIRA_INTERNAL_SECRET>`
- **AND** the secret is validated
- **AND** unauthorized requests receive 401