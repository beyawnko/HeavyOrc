# HeavyOrc

![HeavyOrc banner](./.github/assets/banner.svg)

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
VITE_APP_URL=https://your-domain.example
```

Keys are optional; the UI hides providers without keys. `VITE_APP_URL` supplies a referer for server-side deployments.

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


