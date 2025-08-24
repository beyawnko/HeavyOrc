// services/deepconf.ts
import { Type } from "@google/genai";
import { getGeminiClient, getOpenAIClient } from './llmService';
import { 
    GEMINI_FLASH_MODEL, 
    GEMINI_PRO_MODEL,
    OPENAI_JUDGE_MODEL,
    OPENAI_REASONING_PROMPT_PREFIX
} from '../constants';

export type TokenTopK = { token: string; logprob: number }[];
export type Step = { token: string; topK: TokenTopK };
export type Trace = { steps: Step[]; text: string };
export type ConfidenceMetric = "mean" | "bottom10" | "tail" | "lowestGroup";

export interface DeepConfOpts {
  kTop?: number;          // top-k for token confidence
  groupWindow?: number;   // sliding window size for group confidence
  tailWindow?: number;    // last-K tokens for tail confidence
  etaPercent?: 10 | 90;   // filtering percent kept
  tau?: number;           // consensus threshold
  warmupTraces?: number;  // Ninit
  maxBudget?: number;     // K
  minTokensBeforeStop?: number; // avoid stopping ultra-early
}

export const DEFAULTS: Required<DeepConfOpts> = {
  kTop: 5, groupWindow: 2048, tailWindow: 2048,
  etaPercent: 90, tau: 0.95, warmupTraces: 8,
  maxBudget: 16, minTokensBeforeStop: 32,
};

// --- Judge/Verifier for Gemini ---
const judgeSystem = `You are a strict verifier. Return ONLY JSON with fields: {"score": number, "reasons": string[]}. Score in [0,1].`;
const judgeUserTemplate = (prompt: string, answer: string) => `
Task:
- Question/prompt:
"""${prompt}"""
- Model answer:
"""${answer}"""

Rubric (each ~0.2 points):
1) Directly answers the asked question.
2) Uses only information entailed by the prompt/context.
3) Final answer format matches spec (e.g., number/string/code).
4) No contradictions or hedging.
5) Concise and unambiguous.

Return JSON only.`;

export interface JudgeResult {
    score: number;
    reasons: string[];
}

export const judgeAnswer = async (prompt: string, answer: string, agentModel: string): Promise<JudgeResult> => {
    // OpenAI & OpenRouter Judge Logic
    if (agentModel.startsWith('gpt-') || agentModel.includes('/')) {
        try {
            const openaiAI = getOpenAIClient();
            // Per user request, use a specific judge model (gpt-5-mini) with high reasoning for OpenAI agents.
            const systemPrompt = OPENAI_REASONING_PROMPT_PREFIX + judgeSystem;
            const userPrompt = judgeUserTemplate(prompt, answer);

            const completion = await openaiAI.chat.completions.create({
                model: OPENAI_JUDGE_MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0, // Deterministic judging
            });

            const jsonString = completion.choices[0].message.content;
            if (!jsonString) {
                return { score: 0, reasons: ["Judge model returned an empty response."] };
            }

            // The model is instructed to return ONLY JSON. We must robustly parse it.
            const cleanedJsonString = jsonString.trim().match(/\{[\s\S]*\}/)?.[0] ?? '{}';
            const result = JSON.parse(cleanedJsonString);
            
            if (typeof result.score === 'number' && Array.isArray(result.reasons)) {
                return {
                    score: Math.max(0, Math.min(1, result.score)), // Clamp score
                    reasons: result.reasons
                };
            }

            console.warn("OpenAI Judge model returned invalid JSON shape:", result);
            return { score: 0, reasons: ["Invalid JSON response from OpenAI judge model."] };

        } catch (error) {
            console.error("Error during OpenAI answer judging:", error);
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
            if (error instanceof SyntaxError) {
                 return { score: 0, reasons: [`Failed to parse JSON response from OpenAI judge: ${errorMessage}`] };
            }
            return { score: 0, reasons: [`An error occurred while judging the answer with OpenAI: ${errorMessage}`] };
        }
    }
    
    // Existing Gemini Logic
    try {
        // If the agent model is Pro, use the Pro model for judging for consistency. Otherwise, use the fast Flash model.
        const judgeModel = agentModel === GEMINI_PRO_MODEL ? GEMINI_PRO_MODEL : GEMINI_FLASH_MODEL;
        
        const geminiAI = getGeminiClient();
        const response = await geminiAI.models.generateContent({
            model: judgeModel,
            contents: { parts: [{ text: judgeUserTemplate(prompt, answer) }] },
            config: {
                systemInstruction: judgeSystem,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        score: { type: Type.NUMBER },
                        reasons: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING }
                        }
                    },
                    propertyOrdering: ["score", "reasons"],
                },
                temperature: 0, // deterministic judging
            },
        });

        const jsonString = (response.text || '').trim();
        if (!jsonString) {
            return { score: 0, reasons: ["Judge model returned an empty response."] };
        }
        const result = JSON.parse(jsonString);
        
        if (typeof result.score === 'number' && Array.isArray(result.reasons)) {
            return {
                score: Math.max(0, Math.min(1, result.score)), // Clamp score between 0 and 1
                reasons: result.reasons
            };
        }
        
        console.warn("Judge model returned invalid JSON shape:", result);
        return { score: 0, reasons: ["Invalid JSON response from judge model."] };

    } catch (error) {
        console.error("Error during answer judging:", error);
        return { score: 0, reasons: ["An error occurred while judging the answer."] };
    }
};

// --- confidence primitives (from the paper) ---
function tokenConfidence(topK: TokenTopK, k = 5): number {
  const use = topK.slice(0, k);
  if (use.length === 0) return Infinity; // no signal; treat as very confident to avoid false stops
  const mean = use.reduce((s, t) => s + t.logprob, 0) / use.length; // mean logprob
  return -mean; // Ci = -avg logprob  (Eq. 2)
}

function groupConfidence(conf: number[], endIdx: number, window: number): number {
  // The window is implicitly clamped to the number of available tokens.
  // `start` will be >= 0, so the slice will be at most `endIdx + 1` tokens long.
  // This is equivalent to `min(window, endIdx + 1)`.
  const start = Math.max(0, endIdx - window + 1);
  const slice = conf.slice(start, endIdx + 1);
  if (slice.length === 0) return Infinity;
  const mean = slice.reduce((s, x) => s + x, 0) / slice.length;
  return mean;
}

function lowestGroupConfidence(conf: number[], window: number): number {
  if (conf.length === 0) return Infinity;
  let minGC = Infinity;
  for (let i = 0; i < conf.length; i++) {
    const gc = groupConfidence(conf, i, window);
    if (gc < minGC) minGC = gc;
  }
  return minGC;
}

function tailConfidence(conf: number[], tailWindow: number): number {
  const start = Math.max(0, conf.length - tailWindow);
  const slice = conf.slice(start);
  if (slice.length === 0) return Infinity;
  return slice.reduce((s, x) => s + x, 0) / slice.length;
}

function bottomPercentGroupConfidence(conf: number[], window: number, percent: number): number {
  // build all overlapping group confidences, then average the bottom q%
  const gcs: number[] = [];
  for (let i = 0; i < conf.length; i++) gcs.push(groupConfidence(conf, i, window));
  if (gcs.length === 0) return Infinity;
  const sorted = gcs.slice().sort((a, b) => a - b);
  const keep = Math.max(1, Math.floor((percent / 100) * sorted.length));
  const bottom = sorted.slice(0, keep);
  return bottom.reduce((s, x) => s + x, 0) / bottom.length;
}

function traceConfidence(conf: number[], metric: ConfidenceMetric, opts: Required<DeepConfOpts>): number {
  if (conf.length === 0) return Infinity;
  switch (metric) {
    case "mean": return conf.reduce((s, x) => s + x, 0) / conf.length;
    case "tail": return tailConfidence(conf, opts.tailWindow);
    case "bottom10": return bottomPercentGroupConfidence(conf, opts.groupWindow, 10);
    case "lowestGroup": return lowestGroupConfidence(conf, opts.groupWindow);
  }
}

// --- voting ---
export function weightedVote(answers: string[], weights: number[]) {
  const tally = new Map<string, number>();
  answers.forEach((a, i) => tally.set(a, (tally.get(a) ?? 0) + (weights[i] ?? 0)));
  let bestA = "", bestV = -Infinity, total = 0;
  for (const [a, v] of tally) { total += v; if (v > bestV) { bestV = v; bestA = a; } }
  return { answer: bestA, weights: tally, consensus: (bestV <= 0 || total <= 0) ? 0 : bestV / total };
}

function filterTopEta<T>(xs: T[], scores: number[], etaPercent: number): { items: T[]; keptScores: number[] } {
  if (xs.length === 0) return { items: [], keptScores: [] };
  const idx = [...xs.keys()];
  idx.sort((i, j) => scores[j] - scores[i]);      // desc by score
  const keepN = Math.max(1, Math.floor((etaPercent / 100) * xs.length));
  const keptIdx = idx.slice(0, keepN);
  return { items: keptIdx.map(i => xs[i]), keptScores: keptIdx.map(i => scores[i]) };
}

// Your provider should yield {token, topK} as it streams
export type Provider = {
  stream(onDelta: (step: Step) => void, abort: AbortSignal): Promise<{ text: string, steps: Step[] }>;
};

// Type for a provider that generates a full trace at once (for Gemini/Judge).
export type TraceProvider = {
    generate(prompt: string, abortSignal: AbortSignal): Promise<Trace>;
};

// --- DeepConf Offline ---
export async function deepConfOffline(
  provider: Provider,
  extractAnswer: (t: Trace) => string,
  metric: ConfidenceMetric,
  optsIn: DeepConfOpts = {}
): Promise<{ answer: string, content: string }> {
    const opts = { ...DEFAULTS, ...optsIn };
    const tracePromises: Promise<Trace>[] = [];
    const traceCount = opts.maxBudget ?? DEFAULTS.maxBudget;

    for (let i = 0; i < traceCount; i++) {
        tracePromises.push(provider.stream(() => {}, new AbortController().signal));
    }
    
    const traces = await Promise.all(tracePromises);
    const confs = traces.map(t => t.steps.map(s => tokenConfidence(s.topK, opts.kTop)));
    const C = confs.map(c => traceConfidence(c, metric, opts));
    const answers = traces.map(extractAnswer);

    const { items: answersF, keptScores: CF } = filterTopEta(answers, C, opts.etaPercent ?? DEFAULTS.etaPercent);
    const { answer } = weightedVote(answersF, CF);

    // Find the original trace that produced the winning answer
    const winningTrace = traces.find(t => extractAnswer(t) === answer)
    return { answer, content: winningTrace?.text ?? "Could not determine winning trace." };
}

// --- DeepConf Online (Algorithm 2, “lowestGroup” for warmup/threshold) ---
export async function deepConfOnline(
  provider: Provider,
  extractAnswer: (t: Trace) => string,
  optsIn: DeepConfOpts = {}
): Promise<{ answer: string, content: string }> {
  const opts = { ...DEFAULTS, ...optsIn };
  const traces: Trace[] = [];
  const warmupCount = opts.warmupTraces ?? DEFAULTS.warmupTraces;

  // 1) Warmup
  const warmupPromises: Promise<Trace>[] = [];
  for (let i = 0; i < warmupCount; i++) {
    warmupPromises.push(provider.stream(() => {}, new AbortController().signal));
  }
  const warmup = await Promise.all(warmupPromises);

  const warmupConfs = warmup.map(t => t.steps.map(s => tokenConfidence(s.topK, opts.kTop)));
  const warmupScores = warmupConfs.map(c => lowestGroupConfidence(c, opts.groupWindow));
  const sorted = [...warmupScores].sort((a, b) => a - b);
  
  const keepP = opts.etaPercent ?? DEFAULTS.etaPercent;
  const pct = 100 - keepP; // keep top-η% => threshold at (100-η)th percentile
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((pct / 100) * sorted.length)));
  const s = sorted[idx]; // stopping threshold

  // initialize votes from warmup
  traces.push(...warmup);
  let answers = traces.map(extractAnswer);
  let weights = warmupConfs.map(c => traceConfidence(c, "lowestGroup", opts)); // use same family for init
  let { answer: best, consensus } = weightedVote(answers, weights);
  const maxBudget = opts.maxBudget ?? DEFAULTS.maxBudget;

  // 2) Online loop
  while (consensus < (opts.tau ?? DEFAULTS.tau) && traces.length < maxBudget) {
    const abort = new AbortController();
    const confList: number[] = [];
    const steps: Step[] = [];
    let text = '';

    try {
        const result = await provider.stream(
            (step: Step) => {
                steps.push(step);
                text += step.token;
                // update token & group confidence
                const ci = tokenConfidence(step.topK, opts.kTop);
                confList.push(ci);
                if (steps.length >= (opts.minTokensBeforeStop ?? DEFAULTS.minTokensBeforeStop)) {
                const gc = groupConfidence(confList, confList.length - 1, opts.groupWindow);
                if (gc < s) {
                    abort.abort("Early stop due to low confidence");
                }
                }
            },
            abort.signal
        );
        text = result.text; // Ensure we get the full text if it didn't abort
    } catch (e) {
        if ((e as Error).name !== 'AbortError') {
            console.error("DeepConf stream error:", e);
        }
    }


    const trace: Trace = { steps, text };
    traces.push(trace);

    const confs = trace.steps.map(s_ => tokenConfidence(s_.topK, opts.kTop));
    const Ct = traceConfidence(confs, "lowestGroup", opts);

    // (re)compute votes with filtering + weights
    const allAnswers = traces.map(extractAnswer);
    const allScores = [
      ...weights,
      Ct
    ];
    weights.push(Ct); // update weights for next iteration

    const filtered = filterTopEta(allAnswers, allScores, opts.etaPercent ?? DEFAULTS.etaPercent);
    const voteResult = weightedVote(filtered.items, filtered.keptScores);
    best = voteResult.answer;
    consensus = voteResult.consensus;
  }
  
  const winningTrace = traces.find(t => extractAnswer(t) === best);
  return { answer: best, content: winningTrace?.text ?? "Could not determine winning trace." };
}

// --- DeepConf Offline with Judge ---
export async function deepConfOfflineWithJudge(
  provider: TraceProvider,
  prompt: string,
  extractAnswer: (t: Trace) => string,
  agentModel: string,
  optsIn: DeepConfOpts = {}
): Promise<{ answer: string, content: string }> {
    const opts = { ...DEFAULTS, ...optsIn };
    const tracePromises: Promise<Trace>[] = [];
    const traceCount = opts.maxBudget ?? DEFAULTS.maxBudget;

    for (let i = 0; i < traceCount; i++) {
        tracePromises.push(provider.generate(prompt, new AbortController().signal));
    }
    
    const traces = await Promise.all(tracePromises);
    const answers = traces.map(extractAnswer);

    // Score each trace using the judge model
    const scorePromises = traces.map(t => judgeAnswer(prompt, t.text, agentModel));
    const scores = (await Promise.all(scorePromises)).map(r => r.score);

    const { items: answersF, keptScores: scoresF } = filterTopEta(answers, scores, opts.etaPercent ?? DEFAULTS.etaPercent);
    const { answer } = weightedVote(answersF, scoresF);

    const winningTrace = traces.find(t => extractAnswer(t) === answer);
    return { answer, content: winningTrace?.text ?? "Could not determine winning trace." };
}

// --- DeepConf Online with Judge ---
export async function deepConfOnlineWithJudge(
  provider: TraceProvider,
  prompt: string,
  extractAnswer: (t: Trace) => string,
  agentModel: string,
  optsIn: DeepConfOpts = {}
): Promise<{ answer: string, content: string }> {
    const opts = { ...DEFAULTS, ...optsIn };
    const traces: Trace[] = [];
    const scores: number[] = [];
    const warmupCount = opts.warmupTraces ?? DEFAULTS.warmupTraces;

    // 1) Warmup
    const warmupPromises: Promise<Trace>[] = [];
    for (let i = 0; i < warmupCount; i++) {
        warmupPromises.push(provider.generate(prompt, new AbortController().signal));
    }
    const warmupTraces = await Promise.all(warmupPromises);
    
    // Score warmup traces
    const warmupScorePromises = warmupTraces.map(t => judgeAnswer(prompt, t.text, agentModel));
    const warmupScores = (await Promise.all(warmupScorePromises)).map(r => r.score);
    
    // initialize votes from warmup
    traces.push(...warmupTraces);
    scores.push(...warmupScores);
    
    let answers = traces.map(extractAnswer);
    const filteredWarmup = filterTopEta(answers, scores, opts.etaPercent ?? DEFAULTS.etaPercent);
    let { answer: best, consensus } = weightedVote(filteredWarmup.items, filteredWarmup.keptScores);
    
    const maxBudget = opts.maxBudget ?? DEFAULTS.maxBudget;

    // 2) Online loop
    while (consensus < (opts.tau ?? DEFAULTS.tau) && traces.length < maxBudget) {
        const newTrace = await provider.generate(prompt, new AbortController().signal);
        const { score } = await judgeAnswer(prompt, newTrace.text, agentModel);
        
        traces.push(newTrace);
        scores.push(score);

        // (re)compute votes with filtering + weights
        const allAnswers = traces.map(extractAnswer);
        const filtered = filterTopEta(allAnswers, scores, opts.etaPercent ?? DEFAULTS.etaPercent);
        const voteResult = weightedVote(filtered.items, filtered.keptScores);
        best = voteResult.answer;
        consensus = voteResult.consensus;
    }
  
    const winningTrace = traces.find(t => extractAnswer(t) === best);
    return { answer: best, content: winningTrace?.text ?? "Could not determine winning trace." };
}
