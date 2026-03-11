## ADDED Requirements

### Requirement: Each org has a provisioned git skill repo
The system SHALL automatically create a bare git repository for each organisation when that org is first created (or on first fleet config access). This repo stores all of the org's Pi skills as subdirectories, each containing a `SKILL.md` and any companion files (scripts, references, assets).

#### Scenario: Org is created — skill repo provisioned automatically
- **WHEN** a new organisation is created in Kira
- **THEN** a bare git repo is initialised at `<data-dir>/skill-repos/<org-id>.git` with an initial empty commit on `main`, and the repo URL is stored in the org record

#### Scenario: Skill repo URL is stable and unique per org
- **WHEN** two different orgs both have fleet configs
- **THEN** each has its own isolated git repo; commits to one org's repo do not affect any other org

### Requirement: Org admins can create and update skills via the Kira API
The system SHALL expose API routes that allow org admins to create, read, update, and delete skills in the org's git skill repo. Each operation commits the change to the repo's `main` branch with an audit trail (committer identity, timestamp).

#### Scenario: Admin creates a new skill with multiple files
- **WHEN** an admin sends `POST /api/orgs/:id/fleet/skills` with `{ name: "code-review", files: [{ path: "SKILL.md", content: "..." }, { path: "scripts/review.sh", content: "..." }] }`
- **THEN** the files are written to `code-review/` in the skill repo and committed to `main`, and the skill appears in `GET /api/orgs/:id/fleet/skills`

#### Scenario: Admin updates an existing skill file
- **WHEN** an admin sends `PUT /api/orgs/:id/fleet/skills/:name/files/:filepath` with updated content
- **THEN** the file is updated in the repo via a new commit; the previous version remains accessible in git history

#### Scenario: Admin deletes a skill
- **WHEN** an admin sends `DELETE /api/orgs/:id/fleet/skills/:name`
- **THEN** the entire skill directory is removed from the repo in a new commit; the skill no longer appears in the skill list

#### Scenario: Non-admin attempts to modify skills
- **WHEN** a non-admin user attempts to create, update, or delete a skill
- **THEN** the server returns `403 Forbidden`

### Requirement: Org admins can configure fleet-wide Pi settings
The system SHALL store a fleet config record per org in the database containing: default model/provider, default thinking level, additional npm/git packages, and any extra Pi settings. This config is merged with the skill repo reference when `PiExecutor` fetches the resolved config.

#### Scenario: Admin sets default model
- **WHEN** an admin sends `PUT /api/orgs/:id/fleet/config` with `{ defaultModel: "anthropic/claude-sonnet-4", defaultThinkingLevel: "medium" }`
- **THEN** the config is stored and returned by `GET /api/orgs/:id/fleet/config/resolved`

#### Scenario: Project-level config overrides org-level config
- **WHEN** a project has its own fleet config overrides (e.g., a different `defaultModel`)
- **THEN** `GET /api/projects/:id/fleet/config/resolved` returns the merged result with project values winning over org defaults

### Requirement: PiExecutor materializes fleet config before spawning Pi
The system SHALL, immediately before spawning the `pi` process for a task, fetch the resolved fleet config from the Kira API and write a `.pi/settings.json` file into the worktree root. This file MUST reference the org's skill repo using Pi's `git:` package source syntax so Pi clones/pulls the skills natively.

#### Scenario: settings.json written with skill repo and model config
- **WHEN** `PiExecutor::spawn()` is called for a task belonging to org "acme"
- **THEN** `worktree/.pi/settings.json` is written containing `{ "packages": ["git:<skill-repo-url>@main"], "defaultModel": "<org-model>", "extensions": ["@kira-code/pi-extension"] }` before the `pi` process starts

#### Scenario: Pi clones skill repo on first run
- **WHEN** `pi` starts with a `settings.json` referencing a git skill repo it has not seen before
- **THEN** Pi clones the repo to `.pi/git/<host>/<path>/` and loads all skills from it; the agent's available skill list includes the org's custom skills

#### Scenario: Pi pulls latest skills on subsequent runs
- **WHEN** `pi` starts and the skill repo has already been cloned
- **THEN** Pi performs a `git pull` to pick up any skill updates committed since the last run

#### Scenario: Fleet config is unavailable (network error)
- **WHEN** `PiExecutor` cannot reach the Kira API to fetch the fleet config
- **THEN** the executor falls back to writing a minimal `settings.json` with only the `@kira-code/pi-extension` entry, logs a warning, and continues spawning `pi` rather than failing the task entirely

#### Scenario: settings.json is cleaned up after task completes
- **WHEN** the `pi` process exits (success, error, or timeout)
- **THEN** `PiExecutor` removes `worktree/.pi/settings.json` so the worktree is left in the same state as before the task ran

### Requirement: Fleet config UI in the Kira remote web app
The system SHALL provide a fleet configuration screen in `packages/remote-web` where org admins can view, create, edit, and delete skills, and adjust org-wide Pi settings (model, thinking level, additional packages).

#### Scenario: Admin views skill list
- **WHEN** an org admin opens the Fleet Config screen
- **THEN** a list of all skills in the org's skill repo is displayed, showing each skill's name and description (from `SKILL.md` frontmatter)

#### Scenario: Admin edits a skill file in the UI
- **WHEN** an admin clicks on a skill and edits a file (e.g., `SKILL.md` or `scripts/review.sh`)
- **THEN** the updated content is sent to the API, committed to the skill repo, and the UI reflects the saved state

#### Scenario: Admin adds a companion file to an existing skill
- **WHEN** an admin uploads or pastes a new file (e.g., `references/api-docs.md`) into an existing skill
- **THEN** the file is committed to the skill's directory in the repo and appears alongside existing files in the UI
