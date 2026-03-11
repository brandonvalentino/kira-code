## ADDED Requirements

### Requirement: All user-facing strings use "Kira Code" branding
The system SHALL replace all occurrences of "Vibe Kanban", "vibe-kanban", "vibekanban", and "VibeKanban" with the appropriate "Kira Code", "kira-code", "kiracode", or "KiraCode" form across the entire codebase, including source files, configuration, documentation, and assets.

#### Scenario: Application title shown in browser tab
- **WHEN** a user opens the Kira web app
- **THEN** the browser tab displays "Kira Code" (not "Vibe Kanban")

#### Scenario: No legacy brand strings in source
- **WHEN** `grep -r "vibe.kanban\|VibeKanban\|vibekanban" --include="*.ts" --include="*.tsx" --include="*.rs" --include="*.toml" --include="*.json"` is run at the repo root
- **THEN** zero matches are returned

### Requirement: Package metadata updated in all manifests
The system SHALL update `name`, `description`, and `repository` fields in all `Cargo.toml` and `package.json` files to reflect "kira-code" naming.

#### Scenario: Cargo workspace publishes under new name
- **WHEN** `cargo metadata --no-deps` is run
- **THEN** all crate names that previously included "vibe-kanban" or "vk-" prefix use "kira-" prefix instead

#### Scenario: npm package.json uses new name
- **WHEN** `cat packages/local-web/package.json | jq .name` is run
- **THEN** the output is `"kira-code-local-web"` (or equivalent new name), not the old "vibe-kanban" name

### Requirement: Docker images and CI references use updated names
The system SHALL update all Dockerfile image names, CI workflow names, and environment variable prefixes (e.g., `VK_` → `KIRA_`) to reflect the new brand.

#### Scenario: Docker image builds with new name
- **WHEN** the Docker build command is run
- **THEN** the resulting image is tagged `kira-code:<version>`, not `vibe-kanban:<version>`

#### Scenario: Legacy VK_ env vars remain functional during transition
- **WHEN** a deployment sets `VK_SHARED_API_BASE` (old prefix)
- **THEN** the application reads it as a fallback if `KIRA_SHARED_API_BASE` is not set, and logs a deprecation warning
