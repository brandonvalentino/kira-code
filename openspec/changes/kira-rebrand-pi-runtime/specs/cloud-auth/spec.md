## ADDED Requirements

### Requirement: All remote API routes require authentication
The system SHALL apply the `trusted-key-auth` middleware to all routes in `crates/remote` such that unauthenticated requests receive `401 Unauthorized`.

#### Scenario: Request with valid API key
- **WHEN** a client sends a request to any `/v1/*` route with a valid `Authorization: Bearer <api-key>` header
- **THEN** the request is processed normally and a 2xx response is returned

#### Scenario: Request without authorization header
- **WHEN** a client sends a request to any `/v1/*` route without an `Authorization` header
- **THEN** the server responds with `401 Unauthorized` and a JSON body `{"error": "unauthorized"}`

#### Scenario: Request with invalid or expired API key
- **WHEN** a client sends a request with a malformed or expired `Authorization: Bearer` token
- **THEN** the server responds with `401 Unauthorized` and does not process the request

#### Scenario: Health check route is unauthenticated
- **WHEN** a client sends `GET /health` without any authorization header
- **THEN** the server responds with `200 OK` (health checks must remain unauthenticated for load balancers)

### Requirement: OIDC login flow for team deployments
The system SHALL support GitHub OAuth as the primary OIDC provider, allowing users to log in via the Kira UI and receive a session JWT.

#### Scenario: User initiates GitHub OAuth login
- **WHEN** the user clicks "Sign in with GitHub" on the Kira remote login page
- **THEN** the browser is redirected to GitHub's OAuth authorization URL with the correct `client_id` and `scope`

#### Scenario: GitHub OAuth callback succeeds
- **WHEN** GitHub redirects to the configured callback URL with a valid `code` parameter
- **THEN** the server exchanges the code for an access token, retrieves the user's GitHub profile, upserts a user record in the database, and issues a signed session JWT

#### Scenario: GitHub OAuth callback fails
- **WHEN** GitHub redirects with an `error` parameter or the token exchange fails
- **THEN** the server redirects the user to the login page with an error query parameter and logs the failure

### Requirement: Short-lived extension tokens for Pi extension API access
The system SHALL issue scoped, short-lived JWTs for use by the Kira Pi Extension, separate from user session tokens.

#### Scenario: Extension token issued at task start
- **WHEN** a `pi` execution begins for a given task
- **THEN** the server generates a JWT scoped to that task's ID with a 2-hour expiry and injects it as `KIRA_EXTENSION_TOKEN` in the `pi` process environment

#### Scenario: Extension token is rejected for out-of-scope resources
- **WHEN** the Pi extension presents a task-scoped JWT and attempts to access a different task's data
- **THEN** the server returns `403 Forbidden`

#### Scenario: Extension token expires
- **WHEN** the Pi extension presents a JWT that has passed its `exp` claim
- **THEN** the server returns `401 Unauthorized`
