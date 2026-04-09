# StudioNow Script Creator

AI-powered production script generator built for StudioNow's Coca-Cola work. Diagnoses briefs, chooses structural engines, and outputs three-column production scripts in StudioNow house style.

## Two ways to use it

### 1. Claude Skill (Claude Code / Cowork)

Drop this folder into a Claude project. `CLAUDE.md` and the `references/` folder provide the full strategic framework.

### 2. Web App (Netlify)

A standalone web app where anyone can enter a brief and get a script. Supports file attachments (PDFs, Word docs, images) that Claude uses as reference material.

**Local development:**
```
cd studionow-web
cp .env.example .env        # then add your Anthropic API key
npm install
npx netlify-cli dev          # serves at http://localhost:8888
```

## Project structure

```
CLAUDE.md                          # Skill instructions (root context for Claude)
references/                        # 10 reference guides (diagnosis, engines, voice, etc.)
examples/                          # Real Coca-Cola script examples (.docx)
studionow-web/
  public/index.html                # Frontend — form, file upload, output display
  netlify/functions/
    system-prompt.mjs              # Web app system prompt (labeled sections)
    generate.mjs                   # API handler — attachments, streaming, Claude API
  package.json                     # Dependencies (Anthropic SDK, mammoth)
  netlify.toml                     # Netlify build config
```

## What it produces

Scripts in a three-column table: **AUDIO/VO | TC | VISUALS**

Handles three genres:
- **Business Case / Award Submission** — metrics-driven narratives
- **Platform / Product Explainer** — tool/system introductions
- **Experiential / Consumer Journey** — retail/brand experiences

## Attachments

The web app accepts file attachments that inform the script:
- **Images** — mood boards, brand assets, location photos → visual direction
- **PDFs** — briefs, guidelines, data decks → metrics, messaging, tone
- **Word docs** — previous scripts, treatments → structural reference

Files are base64-encoded client-side and sent to the Claude API as native content blocks (images, PDFs) or extracted text (DOCX via mammoth).

## Updating

See [HOW-TO-REDEPLOY.md](HOW-TO-REDEPLOY.md) for instructions on syncing skill changes to the web app.

**Key principle:** The system prompt in `system-prompt.mjs` is organized into labeled, numbered sections. Edit the section you need, deploy, done.
