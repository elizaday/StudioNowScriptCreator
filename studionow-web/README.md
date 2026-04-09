# StudioNow Script Creator — Web App

A web interface for the StudioNow Script Creator skill. Enter a brief, get a production-ready script in the StudioNow three-column format.

## Deploy to Netlify

1. Push this folder to a GitHub repo (or drag-drop to Netlify)
2. In Netlify dashboard, go to **Site settings > Environment variables**
3. Add: `ANTHROPIC_API_KEY` = your Anthropic API key
4. Deploy

## Local development

```bash
npm install
npx netlify dev
```

Requires `ANTHROPIC_API_KEY` in a `.env` file or environment.

## How it works

- `public/index.html` — Frontend with brief intake form
- `netlify/functions/generate.mjs` — Serverless function that calls Claude with the full StudioNow skill as the system prompt
- The skill (voice, genre detection, format rules, visual language) is baked into the system prompt — no external files needed at runtime
