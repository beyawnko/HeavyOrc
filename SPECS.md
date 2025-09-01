# SPECS

## Overview
- purpose: Demonstrates mixture-of-experts orchestration for large language models with live arbitration.
- application-type: Single-page web application.

## Tech Stack
- language: TypeScript.
- framework: React 18.
- bundler: Vite 5.
- styling: Tailwind CSS.
- runtime: Node.js for tooling; browser for execution.
- testing: Vitest.

## Dependencies
### runtime
- @dqbd/tiktoken: ^1.0.22
- @google/genai: ^1.15.0
- focus-trap-react: ^11.0.4
- framer-motion: ^11.3.12
- jszip: ^3.10.1
- openai: ^4.52.7
- react: ^18.3.1
- react-dom: ^18.3.1
- react-virtuoso: ^4.14.0
- wasm-feature-detect: ^1.8.0
- zod: ^3.25.76
### development
- @types/react
- @types/react-dom
- @vitejs/plugin-react
- autoprefixer
- postcss
- tailwindcss
- typescript
- vite
- vitest

## Directory Layout
- assets/: static images.
- components/: UI elements and modals.
- lib/: utilities, hooks, and helpers.
- moe/: mixture-of-experts engine (dispatcher, arbiter, orchestrator).
- services/: LLM integrations and DeepConf logic.
- tests/: unit tests.
- scripts/: build-time helpers.

## Core Modules
- `services/llmService.ts`: manages API keys, retry helpers, and client instances for Gemini, OpenAI, and OpenRouter.
- `services/deepconf.ts`: confidence-driven generation strategies (offline, online, judge-assisted) and scoring.
- `services/geminiUtils.ts`: rate-limit handling and retry logic specialized for Gemini API.
- `moe/dispatcher.ts`: invokes expert agents in parallel and collects drafts.
- `moe/arbiter.ts`: synthesizes drafts from experts into a final answer.
- `moe/orchestrator.ts`: coordinates dispatching, arbitration, and stream delivery.
- `lib/sessionMigration.ts`: migrates saved agent configuration schemas.
- `lib/loadExperts.ts`: fetches expert definitions from config files.

## Environment
- required-variables: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `VITE_APP_URL`.
- optional-legacy-variable: `API_KEY` (fallback for Gemini).
- configuration-files: `vite.config.ts`, `tailwind.config.js`, `tsconfig.json`, `postcss.config.js`.

## Scripts
- `install-missing-deps.mjs`: installs specific runtime deps if absent.
- `sync-doc-assets.mjs`: copies documentation assets into the public folder.

## Testing
- command: `npm test`.
- framework: Vitest.
- coverage-target: 80% line coverage.
- mandatory-areas: error handling paths and provider API integrations.

## Data Flow
1. user-input -> `components/PromptInput.tsx`.
2. configurations -> `moe/orchestrator.ts` dispatches agents.
3. agents -> `services/llmService.ts` and provider APIs.
4. drafts -> `moe/arbiter.ts` for synthesis.
5. final-answer -> `components/FinalAnswerCard.tsx` and history storage.
6. errors -> `moe/orchestrator.ts` propagates failures to `App.tsx` for user notification.

