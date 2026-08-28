# Repository Guidelines

## Project Structure & Module Organization

This repository is currently an empty workspace: no source, test, asset, or configuration directories were present during review. As the project grows, keep production code under a clearly named source directory (for example, `src/`), tests in `tests/` or alongside the modules they cover, and static files in `assets/` or `public/`. Update this section when the project’s layout is established.

## Build, Test, and Development Commands

No build system, package manifest, or test runner is currently configured. Do not add undocumented commands to scripts or CI. When tooling is introduced, document the canonical commands here, such as:

- `npm install` — install declared dependencies.
- `npm run build` — create the production build.
- `npm test` — run the complete test suite.
- `npm run lint` — check formatting and static-analysis rules.

Commands should be runnable from the repository root and should match the scripts defined in the project’s manifest.

## Coding Style & Naming Conventions

Use the formatter and linter selected by the project; committed code should pass both before review. Prefer four-space indentation unless the language ecosystem or existing formatter specifies otherwise, keep functions and modules focused, and avoid unnecessary abstractions. Use `PascalCase` for types and components, `camelCase` for variables and functions, and `kebab-case` for new directory or asset names unless the language requires a different convention. Keep filenames consistent with their exported symbol or primary responsibility.

## Testing Guidelines

Add tests for new behavior and regressions. Test files should use the project’s established pattern (for example, `*.test.ts` or `test_*.py`) and describe observable behavior rather than implementation details. Run the full suite locally before submitting changes; maintain the coverage threshold once one is configured.

## Commit & Pull Request Guidelines

No Git history is available, so no repository-specific commit convention could be inferred. Use short, imperative commit subjects (for example, `Add initial project structure`) and keep unrelated changes separate. Pull requests should explain the purpose, summarize the implementation, list validation commands and results, and link related issues. Include screenshots or recordings for visible UI changes and call out configuration or migration steps.

## Configuration & Security

Never commit secrets, credentials, generated build output, or local environment files. Provide safe example configuration such as `.env.example` when needed, and document required setup in the project README. Review dependency and configuration changes for unintended exposure before merging.
