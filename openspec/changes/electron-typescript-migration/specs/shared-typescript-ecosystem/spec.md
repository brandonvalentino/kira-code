## ADDED Requirements

### Requirement: Shared TypeScript types
The system SHALL provide a `packages/shared/` package containing all shared TypeScript types used by both the Electron app and cloud API.

#### Scenario: Types are defined once
- **WHEN** a new type is needed (e.g., `Issue`, `Project`, `Session`)
- **THEN** it is defined in `packages/shared/types.ts`
- **AND** it is importable by both `packages/electron-app` and `packages/cloud-api`
- **AND** no type generation script is required

#### Scenario: Type changes propagate immediately
- **WHEN** a type is modified in `packages/shared/`
- **THEN** TypeScript compilation errors appear in dependent packages
- **AND** no intermediate generation step is needed

### Requirement: Shared Zod validation schemas
The system SHALL provide Zod validation schemas in `packages/shared/` for request validation and type inference.

#### Scenario: Schema validates API request
- **WHEN** a request is received by cloud-api
- **THEN** the request body is validated against a Zod schema from `packages/shared/`
- **AND** invalid requests return 400 with error details

#### Scenario: Schema infers TypeScript type
- **WHEN** a Zod schema is defined
- **THEN** the TypeScript type is inferred via `z.infer<typeof schema>`
- **AND** the type is used throughout the codebase without duplication

### Requirement: Shared utility functions
The system SHALL provide shared utility functions in `packages/shared/` for common operations used by both Electron and cloud.

#### Scenario: Utility function is shared
- **WHEN** a utility function is needed in both Electron and cloud
- **THEN** it is defined in `packages/shared/utils.ts`
- **AND** it is importable by both packages
- **AND** it is tested once in `packages/shared/__tests__/`

### Requirement: No ts-rs or type generation
The system SHALL NOT use ts-rs, generate-types scripts, or any external type generation tools.

#### Scenario: No type generation in CI
- **WHEN** CI runs type checking
- **THEN** no type generation step is executed
- **AND** TypeScript compilation is the only type-related step

#### Scenario: No Rust type definitions
- **WHEN** a new type is needed
- **THEN** it is defined in TypeScript only
- **AND** no Rust struct or enum is created
- **AND** no TS macro is applied

### Requirement: Monorepo package structure
The system SHALL organize code as a pnpm monorepo with clear package boundaries.

#### Scenario: Package dependencies are explicit
- **WHEN** a package needs types or utilities
- **THEN** it declares an explicit dependency in `package.json`
- **AND** the dependency is resolved via pnpm workspace protocol

#### Scenario: Packages are independently buildable
- **WHEN** a package is built
- **THEN** it can be built independently of other packages
- **AND** it only depends on its declared dependencies