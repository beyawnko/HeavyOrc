# Cipher Memory System Plan

This document tracks the phased implementation of persistent conversational context using Cipher's vector memory. Each phase notes fallback paths and open questions so work can resume across sessions.

---

## Phase 0 – Integration Baseline
- Audit current service calls to identify context-related bugs (missing `sessionId`, cache eviction issues, inconsistent prompt assembly).
- Document API contracts with Cipher and confirm expected response shapes.
- **Fallback:** If audit reveals blocking issues, log them in this file and proceed with mocked interfaces to unblock later phases.

## Phase 1 – Session Cache (System 1)
- Generate a stable `sessionId` and persist it in `localStorage`.
- Maintain an in-memory LRU queue of recent exchanges keyed by `sessionId`.
- Expose helpers: `loadSessionContext(sessionId)` and `appendSessionContext(sessionId, message)`.
- **Fallback:** When `localStorage` is unavailable, use a transient in-memory cache and warn the user about non‑persistent context.

## Phase 2 – Cipher Vector Memory (System 2)
- After each run, call `cipher.storeRun({ sessionId, prompt, response, timestamp })`.
- For new prompts, query `cipher.search({ sessionId, query })` and retrieve top matches.
- Implement retry/backoff using existing `fetchWithRetry` utilities.
- **Fallback:** On store/search failure, continue with session cache only and queue failed writes for retry.

## Phase 3 – Context Reconstruction
- Combine: `longTermMemories + sessionCache + newPrompt` before dispatching experts.
- Summarize overflowing history and store summaries back to Cipher to keep prompts within token limits.
- **Fallback:** If summarization fails or exceeds budget, truncate oldest entries and mark a TODO here for later refinement.

## Phase 4 – Migration & Security
- Allow clients to export/import `sessionId` to migrate context across devices.
- Sign `sessionId` tokens server‑side to prevent tampering.
- Enforce rate limits (30 req/min) and max payload sizes (~400KB) for memory operations.
- **Fallback:** If signing service is unavailable, fall back to opaque UUIDs and flag this section for follow‑up.

## Phase 5 – Testing & Observability
- Unit tests for cache eviction, retry logic, and prompt assembly.
- Integration tests using stubbed Cipher responses to simulate store/search.
- Emit structured logs for memory operations for debugging and cost tracking.
- **Fallback:** If live tests are blocked by API quotas, run stubbed tests only and note pending live validation.

---

### Completed Steps
- [x] Implement Phase 1 helpers (`loadSessionContext`, `appendSessionContext`).
- [x] Draft unit tests for LRU cache behavior.
- [x] Stub Cipher client with session-aware `storeRun` and `search` calls.
- [x] Wire session cache with Cipher service and propagate `sessionId` in App.
- [x] Decide on queue size and summarization thresholds. (`SESSION_CACHE_MAX_ENTRIES` set to 20; summarize after ~4000 chars)
- [x] Add tests for context reconstruction with long-term and session caches.
- [x] Implement summarization logic for overflowing session history.
- [x] Enforce rate limits and payload caps on memory operations.
- [x] Add session export/import utilities for migrating context.
- [x] Sign and validate session IDs to prevent tampering.
- [x] Emit structured logs/metrics for memory operations.

## Phase 6 – Future Enhancements
- Merge session histories when a user authenticates so long-term memories persist across devices.
- Cache `cipher.search` results with a short TTL to avoid redundant vector queries.
- Surface memory operation metrics in a lightweight dashboard for debugging.
- **Fallback:** If metrics tooling is unavailable, emit console logs and revisit instrumentation later.

### Next Steps
- [ ] Consolidate session histories on sign-in.
- [ ] Introduce TTL-based caching for `cipher.search`.
- [ ] Display memory metrics in a debug view.
