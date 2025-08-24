# HeavyOrc

![HeavyOrc banner](./assets/banner.png)

HeavyOrc is a web application that demonstrates a Mixture-of-Experts orchestration pattern for large language models. It dispatches prompts to multiple "expert" agents across different providers and synthesises their drafts into a final answer in real time.

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
```

Keys are optional; the UI hides providers without keys.

## Development

1. Install dependencies: `npm install`
2. Configure your `.env` file as above.
3. Start the dev server: `npm run dev`

## GitHub Pages deployment

1. In `vite.config.ts` set `base: '/HeavyOrc/'`.
2. Build the site: `npm run build`
3. Commit and push the `dist/` directory to a `gh-pages` branch.
4. Enable GitHub Pages for that branch and visit `https://<username>.github.io/HeavyOrc/`.

## DeepConf overview

`services/deepconf.ts` provides several confidence-driven strategies:

- **Offline**: generate many traces then pick the best by consensus.
- **Online**: stream traces until confidence exceeds a threshold.
- **Judge modes**: use an LLM judge to score traces before voting.

These modes work with any supported provider.


