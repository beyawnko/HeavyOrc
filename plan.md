# MoE Refactoring Plan

This document outlines the phased approach to refactor the "HeavyOrc" application into a more robust, testable, and feature-rich Mixture-of-Experts (MoE) simulation.

---

### Phase 0 - Project Setup & Baseline

**Goal**: Establish a clean, testable foundation before major architectural changes.

*   **0.1 Env + Build Cleanliness**: Standardize environment variables (`.env.example`), build process, and TypeScript configuration (`tsconfig.json`).
*   **0.2 Setup Testing Framework**: Integrate Vitest, @testing-library, and CI to enable test-driven development from the start. (Moved from Phase 6).
*   **0.3 Initial Documentation**: Document the existing architecture and the goals of the refactor. (Moved from Phase 8).
*   **0.4 Configuration Management**: Define a strategy for managing configurations (e.g., `experts.json`) across different environments, including validation.

---

### Phase 1 — MoE Engine Extraction (architecture baseline)

**Goal**: Decouple strategy from UI; make experts/routing/arbitration pluggable.

*   **1.1 Create a formal MoE module**:
    *   `src/moe/types.ts`: Define core interfaces (`Expert`, `RouterDecision`, `MoEPolicy`).
    *   `src/moe/experts.ts`: Load expert configurations.
    *   `src/moe/router.ts`: Implement routing policies.
    *   `src/moe/arbiter.ts`: Implement aggregation strategies.
    *   `src/moe/run.ts`: Orchestrate the route → dispatch → arbitrate flow.
    *   **Refactor**: `App.tsx` calls `moe/run.ts` instead of `services/geminiService.ts` directly.
*   **1.2 Move personas to config**:
    *   `src/config/experts.json`: Data-driven expert definitions.
    *   `src/config/moe.default.json`: Default MoE policies.
*   **1.3 Continuous Documentation**: All new interfaces, modules, and significant decisions will be documented as they are implemented.

---

### Phase 2 — Real Routing (beyond random/round-robin)

**Goal**: Implement intelligent, deterministic routing mechanisms.

*   **2.1 Keyword + rules fallback router**: A fast, deterministic router based on keyword matching.
*   **2.2 Embedding-based router**: Route by semantic similarity using prompt and persona embeddings.
*   **2.3 Load-balancing & capacity**: Track in-flight requests per expert and handle overflow based on policy (drop, spill, queue).

---

### Phase 3 — Expert Dispatch & Sampling Diversity

**Goal**: Increase response diversity and system robustness.

*   **3.1 Differential sampling per expert**: Apply unique sampling parameters (temperature, topK, topP) to each selected expert.
*   **3.2 Retry, timeout, circuit breaker**: Implement robust error handling for individual expert failures.
*   **Success Criterion**: The system demonstrates resilience by successfully recovering from >90% of simulated single-expert failures during integration tests.

---

### Phase 4 — Arbitration Alternatives (quality & speed)

**Goal**: Provide multiple strategies for synthesizing the final answer.

*   **4.1 Add “vote” and “rerank” modes**: Cheaper alternatives to the full synthesis model.
*   **4.2 Dedup & consensus**: Detect and down-weight near-duplicate drafts to improve arbiter efficiency.

---

### Phase 5 — Observability, Budget & Caching

**Goal**: Measure performance and control costs.

*   **5.1 Structured telemetry**: Implement an event emitter for key MoE lifecycle events (routing, dispatch, arbitration).
    *   *Success Criterion*: >95% of MoE lifecycle events are instrumented and visible in a debug console.
*   **5.2 Budget policy & cache**: Introduce request-level budgets and cache results in IndexedDB.
    *   *Success Criterion*: P95 latency for repeated queries is reduced by >50%; token usage can be capped on a per-request basis.

---

### Phase 6 — Simulator & Testing Harness (true “MoE simulation”)

**Goal**: Enable deterministic, offline testing of the full MoE flow.

*   **6.1 Stub LLM + scripted experts**: Create a fake LLM for fast, network-free testing of the orchestration logic.
*   **6.2 Expand Test Coverage**: Write integration tests for complex routing and arbitration scenarios identified during development.

---

### Phase 7 — UX & DX Niceties (fast iteration)

**Goal**: Make the MoE system transparent and easy to control.

*   **7.1 Expert board UI**: Enhance UI to show router scores, capacity, and status.
*   **7.2 Run presets & shareable URLs**: Allow configurations to be saved and shared.

---

### Phase 8 — Final Review, Docs & Guardrails

**Goal**: Ensure the project is maintainable and safe for production use.

*   **8.1 Consolidate and publish guides**: Review and package all continuous documentation into a coherent set of user and architecture guides.
*   **8.2 Security & Privacy Review**: Conduct a review covering potential vulnerabilities such as prompt injection, data handling policies for the cache, and PII redaction.

---

## Concrete "Next PRs" for the Agent (chunked and atomic)
1.	**PR-1: Env, Build, Testing & CI Setup** (Phase 0)
2.	**PR-2: Extract MoE engine** (Phase 1)
3.	**PR-3: Robust dispatch** (Phase 3)
4.	**PR-4: Routing v1 (rules) + capacity** (Phase 2)
5.	**PR-5: Embedding router** (Phase 2)
6.	**PR-6: Arbiter modes & dedup** (Phase 4)
7.	**PR-7: Telemetry, Budgeting & cache** (Phase 5)
8.	**PR-8: Simulator & Integration Tests** (Phase 6)
9.	**PR-9: UX debug panel** (Phase 7)
10.	**PR-10: Final Docs & Guardrails** (Phase 8)
### Follow-up

- Implement a Vitest-based testing setup and replace the placeholder `npm test` script with real unit tests.
