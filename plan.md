# MoE Refactoring Plan

This document outlines the phased approach to refactor the "Gemini Heavy Orchestrator" application into a more robust, testable, and feature-rich Mixture-of-Experts (MoE) simulation.

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

---

### Phase 4 — Arbitration Alternatives (quality & speed)

**Goal**: Provide multiple strategies for synthesizing the final answer.

*   **4.1 Add “vote” and “rerank” modes**: Cheaper alternatives to the full synthesis model.
*   **4.2 Dedup & consensus**: Detect and down-weight near-duplicate drafts to improve arbiter efficiency.

---

### Phase 5 — Observability, Budget & Caching

**Goal**: Measure performance and control costs.

*   **5.1 Structured telemetry**: Implement an event emitter for key MoE lifecycle events (routing, dispatch, arbitration).
*   **5.2 Budget policy & cache**: Introduce request-level budgets and cache results in IndexedDB.

---

### Phase 6 — Simulator & Testing Harness (true “MoE simulation”)

**Goal**: Enable deterministic, offline testing.

*   **6.1 Stub LLM + scripted experts**: Create a fake LLM for fast, network-free testing.
*   **6.2 Add Vitest, @testing-library, and CI**: Formalize the testing framework and integrate into CI.

---

### Phase 7 — UX & DX Niceties (fast iteration)

**Goal**: Make the MoE system transparent and easy to control.

*   **7.1 Expert board UI**: Enhance UI to show router scores, capacity, and status.
*   **7.2 Run presets & shareable URLs**: Allow configurations to be saved and shared.

---

### Phase 8 — Docs & Guardrails

**Goal**: Ensure the project is maintainable and safe.

*   **8.1 Docs**: Create architecture, policy, and testing documentation.
*   **8.2 Safety preprocessing**: Add an optional pre-processing step to redact PII from prompts.

---

## Concrete "Next PRs" for the Agent (chunked and atomic)
1.	**PR-1: Env + Build Cleanliness**
2.	**PR-2: Extract MoE engine**
3.	**PR-3: Routing v1 (rules) + capacity**
4.	**PR-4: Embedding router**
5.	**PR-5: Arbiter modes & dedup**
6.	**PR-6: Robust dispatch**
7.	**PR-7: Budgeting & cache**
8.	**PR-8: Simulator & CI**
9.	**PR-9: UX debug panel**
10.	**PR-10: Docs**
