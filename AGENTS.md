# AGENTS

## Project Intent
- HeavyOrc is a single-page web app that demonstrates mixture-of-experts orchestration for large language models.
- It dispatches prompts to expert agents (Gemini, OpenAI, OpenRouter) and synthesizes their drafts in real time.

## Tech Stack
- TypeScript + React 18
- Vite 5 bundler with Tailwind CSS for styling
- Node.js 18+ tooling
- Vitest for unit tests

## Coding Guidelines
- Use TypeScript with strict typings and React function components.
- Keep modules focused:
  - `components/` for UI elements
  - `services/` for provider integrations, API clients, retry logic, and DeepConf strategies
  - `moe/` for dispatcher, arbiter and orchestrator
  - `lib/` for utilities and hooks
- Centralize constants in `constants.ts` and shared types in `types.ts`.
- When calling external APIs, always use retry/timeout helpers (`fetchWithRetry`, `callWithRetry`, `callWithGeminiRetry`).
- Retry helpers default to 3 attempts with exponential backoff (500ms base delay for `fetchWithRetry`/`callWithRetry`, 1s for `callWithGeminiRetry` with a 10s timeout) and should apply jitter and circuit breakers to avoid thundering herd effects.
- Handle rate limits, server errors, and aborted requests gracefully; prefer user-friendly error messages.
- Maintain consistent formatting (ES modules, 2-space indent, semicolons, matching quote style with surrounding code).
- Update README.md, SPECS.md, or AGENTS.md whenever behavior, deps, or architecture changes.

## Commit Conventions
- Use short, imperative messages prefixed with type: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`.
- Keep commits focused and respond to review feedback promptly.

## Testing & Early Error Detection
- Run `npm test -- --run` before committing. Target ~80% line coverage, especially around error paths and provider integrations.
- Add regression tests for new edge cases.
- Verify build when modifying tooling (`npm run build`).

## Environment
- Node.js 18+ required.
- Development workflow: `npm install`, configure `.env`, then `npm run dev`.
- Store secrets outside version control (see `.env.example`); prefer a secure secrets manager for production.
- Required env vars (see `.env.example`):
  - `GEMINI_API_KEY`  # Gemini API authentication
  - `OPENAI_API_KEY`  # OpenAI API authentication
  - `OPENROUTER_API_KEY`  # OpenRouter API authentication
  Optional:
  - `VITE_APP_URL`  # Application URL.

## Security Best Practices
- Validate and sanitize all user input and outputs; use schema validators like Zod (`z.object({ id: z.string().uuid() })`) and DOMPurify or `escape-html` for sanitization.
- Rate limit upstream API calls and user requests. Document provider-specific limits (e.g., Gemini ~60 RPM, OpenAI plan-specific RPM) and use concurrency guards to prevent overload.
- Rotate keys regularly.

### Memory Layer Security
- Cap sanitized error responses at 32KB to prevent memory exhaustion.
- Implement timeouts and retry/backoff for memory operations.
- Add response size limits (~400KB) for memory fetches.
- Use entropy-based detection for sensitive data in base64 strings.

### URL and Network Safety
- Validate URLs with strict hostname and protocol checks.
- Normalize URLs using NFKC to handle IDN homograph attacks.
- Block private network and localhost access in production.
- Implement rate limiting for memory operations (30 req/min).

### Cache Management
- Set explicit TTLs for cached responses (5 min).
- Implement size-based cache eviction (max 1000 entries).
- Add integrity hashes for remote ESM imports.
- Pin exact versions of CDN-hosted dependencies.

## Known Friction Points
- Past issues center on Gemini timeouts, streaming, and error typing. Mitigation tips:
  - Respect `MIN_GEMINI_TIMEOUT_MS` and `MAX_GEMINI_TIMEOUT_MS` bounds.
  - Use abort signals to cancel long-running streams.
  - Surface 503/429 responses via retry helpers with informative messages.
- Ensure any new provider logic includes comparable timeout and error handling.

