# HeavyOrc

![HeavyOrc banner](./assets/banner.png)

HeavyOrc is a web application that demonstrates a Mixture-of-Experts orchestration pattern for large language models. It dispatches prompts to multiple "expert" agents across different providers and synthesizes their drafts into a final answer in real time.

For a detailed, AI-oriented overview of the architecture and tooling, see the [SPECS.md](./SPECS.md) technical specification.

## Documentation

- [AGENTS.md](./AGENTS.md) – project intent, tech stack, and coding guidelines.
- [SPECS.md](./SPECS.md) – AI-oriented technical specification of the stack and modules.

## Features

- **Multi-provider support**: Gemini, OpenAI and OpenRouter backends.
- **Mixture-of-Experts orchestration**: run parallel experts and merge their outputs with an arbiter.
- **DeepConf**: confidence-driven generation modes (offline, online and judge-assisted).
- **Streaming UI**: live progress bar and gallery of expert drafts.
- **Session tools**: save and reload conversations or export all drafts as a ZIP.

## Providers & API keys

Copy `.env.example` to `.env` and supply the keys for any providers you plan to use:

```env
GEMINI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
OPENROUTER_API_KEY=your_openrouter_key
VITE_APP_URL=https://your-domain.example
# Optional service worker version for cache busting
VITE_SW_VERSION=dev
```

Keys are optional; the UI hides providers without keys. `VITE_APP_URL` supplies a referer for server-side deployments.

The application reads the Gemini key from `GEMINI_API_KEY` (falling back to a legacy `API_KEY` if present).

## Persistent memory (Cipher)

HeavyOrc can persist run history by connecting to a [Cipher](https://www.npmjs.com/package/@byterover/cipher) memory server. During development, start the server in API mode:

```bash
npm run cipher
```

The server defaults to an in-memory vector store (`VECTOR_STORE_TYPE=in-memory`), which requires no additional setup but loses data on restart. To enable persistence in the UI, configure the following environment variables:

```env
VITE_USE_CIPHER_MEMORY=true
VITE_CIPHER_SERVER_URL=http://localhost:3000
# Optionally enforce Content-Security-Policy headers from the memory server
# Set this only if the server exposes "Content-Security-Policy" via CORS
# (see Access-Control-Expose-Headers)
VITE_ENFORCE_CIPHER_CSP=false
```

If the server is not running, HeavyOrc continues to operate with ephemeral in-memory history. Cipher speaks the Model Context Protocol, so the same memory store can be shared with other tools in the future.

Fetched memory snippets are HTML-escaped with [`escape-html`](https://www.npmjs.com/package/escape-html), replacing characters like `&`, `<`, `>`, `"` and `'` before including them in prompts. Error responses are recursively redacted: keys such as `token`, `password`, `secret`, `apiKey` and other credential-like fields—or string values that match those patterns or appear base64-encoded—are replaced with `[REDACTED]`. Redaction patterns are currently hardcoded in [`lib/security.ts`](./lib/security.ts) and can be customized there if needed.
Review and update these patterns regularly to catch newly emerging sensitive data types.

## Reasoning models and context management

Reasoning models such as GPT‑5 and GPT‑5‑mini generate internal reasoning tokens before returning a final answer. These tokens count against the model's context window and are billed as output tokens. To avoid incomplete responses:

- Reserve ample room in the context window—OpenAI recommends leaving at least 25,000 tokens for reasoning and output.
- Use `max_output_tokens` to cap total generated tokens. If the limit is reached, the response status will be `incomplete` with `reason` set to `max_output_tokens`.
- Monitor `output_tokens_details.reasoning_tokens` in the API response to understand usage.

```javascript
import OpenAI from "openai";

const openai = new OpenAI();

const prompt = `
Write a bash script that takes a matrix represented as a string with
format '[1,2],[3,4],[5,6]' and prints the transpose in the same format.
`;

const response = await openai.responses.create({
    model: "gpt-5",
    reasoning: { effort: "medium" },
    input: [
        { role: "user", content: prompt }
    ],
    max_output_tokens: 300,
});

if (response.status === "incomplete" &&
    response.incomplete_details.reason === "max_output_tokens") {
    console.log("Ran out of tokens");
    if (response.output_text?.length > 0) {
        console.log("Partial output:", response.output_text);
    } else {
        console.log("Ran out of tokens during reasoning");
    }
}
```

All `gpt-5` family models, including `gpt-5-mini`, accept the `reasoning` parameter when accessed via the Responses API.

When using function calling with a reasoning model, pass back the reasoning items from the previous response. You can either reference the `previous_response_id` or include all output items from the prior response to maintain the model's chain of thought.

## Development

1. Install dependencies: `npm install`
2. Configure your `.env` file as above.
3. Start the dev server: `npm run dev`
4. Build for production: `npm run build`
5. Preview the build locally: `npm run preview`

## GitHub Pages deployment

1. In `vite.config.ts` set `base: '/HeavyOrc/'`.
2. Add a GitHub Actions workflow to build and deploy automatically:

   ```yaml
   # .github/workflows/deploy.yml
   name: Deploy
   on:
     push:
       branches: [ main ]
   jobs:
     build:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 18
         - run: npm ci && npm run build
         - uses: peaceiris/actions-gh-pages@v3
           with:
             github_token: ${{ secrets.GITHUB_TOKEN }}
             publish_dir: ./dist
   ```

3. Enable GitHub Pages for the `gh-pages` branch created by the workflow and visit `https://USERNAME.github.io/HeavyOrc/`, replacing `USERNAME` with your GitHub handle.

## DeepConf overview

`services/deepconf.ts` provides several confidence-driven strategies:

- **Offline**: generate many traces then pick the best by consensus.
- **Online**: stream traces until confidence exceeds a threshold.
- **Judge modes**: use an LLM judge to score traces before voting.

These modes work with any supported provider.


