# AGENTS

## Project Intent
- HeavyOrc is a single-page web app that demonstrates mixture-of-experts orchestration for large language models.
- It dispatches prompts to expert agents (Gemini, OpenAI, OpenRouter) and synthesizes their drafts in real time.

## Tech Stack
- TypeScript + React 18
- Vite 5 bundler with Tailwind CSS for styling
- Node.js tooling
- Vitest for unit tests

## Coding Guidelines
- Use TypeScript with strict typings and React function components.
- Keep modules focused:
  - `components/` for UI elements
  - `services/` for provider integrations and DeepConf logic
  - `moe/` for dispatcher, arbiter and orchestrator
  - `lib/` for utilities and hooks
- Centralize constants in `constants.ts` and shared types in `types.ts`.
- When calling external APIs, always use retry/timeout helpers (`fetchWithRetry`, `callWithRetry`, `callWithGeminiRetry`).
- Handle rate limits, server errors, and aborted requests gracefully; prefer user-friendly error messages.
- Maintain consistent formatting (ES modules, 2-space indent, semicolons, matching quote style with surrounding code).
- Update README.md or SPECS.md whenever behavior, deps, or architecture changes.

## Commit Conventions
- Use short, imperative messages prefixed with type: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Keep commits focused and respond to review feedback promptly.

## Testing & Early Error Detection
- Run `npm test -- --run` before committing. Target ~80% line coverage, especially around error paths and provider integrations.
- Add regression tests for new edge cases.
- Verify build when modifying tooling (`npm run build`).

## Environment
- Development workflow: `npm install`, configure `.env`, then `npm run dev`.
- Required env vars: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`; optional `VITE_APP_URL`.

## Known Friction Points
- Past issues center on Gemini timeouts, streaming, and error typing. Mitigation tips:
  - Respect `MIN_GEMINI_TIMEOUT_MS` and `MAX_GEMINI_TIMEOUT_MS` bounds.
  - Use abort signals to cancel long-running streams.
  - Surface 503/429 responses via retry helpers with informative messages.
- Ensure any new provider logic includes comparable timeout and error handling.

