# How to Update the StudioNow Web App

When you update the skill (CLAUDE.md or reference files), those changes only affect the Claude skill. The Netlify web app has its own system prompt. Here's how to sync them.

## What lives where

| Component | Location | Purpose |
|-----------|----------|---------|
| **Skill instructions** | `CLAUDE.md` + `references/` | Drives the Claude Code / Cowork skill |
| **Web system prompt** | `studionow-web/netlify/functions/system-prompt.mjs` | Single source of truth for the web app |
| **Web API handler** | `studionow-web/netlify/functions/generate.mjs` | Handles requests, attachments, streaming |
| **Web frontend** | `studionow-web/public/index.html` | User-facing form, file upload, output display |

## Updating the web app's behavior

1. Open `studionow-web/netlify/functions/system-prompt.mjs`.
2. Find the relevant section (they're labeled with comments and numbered).
3. Edit the section content. The prompt is assembled from named constants at the bottom of the file.
4. Deploy (see below).

You do NOT need to touch `generate.mjs` unless you're changing how attachments, streaming, or the API work.

## Deploy options

### Option A: Push to GitHub (auto-deploy)
```
cd studionow-web
git add .
git commit -m "Update script creator prompt"
git push
```

### Option B: Manual Netlify deploy
1. Go to your Netlify dashboard.
2. Drag and drop the `studionow-web` folder onto the deploy area.
3. Wait for the build to finish.

## After deploying

Verify by visiting your site and running a test brief. Check that:
- Script generation works
- File attachments upload and process correctly
- The output quality reflects your prompt changes

## Environment variables

The Netlify site needs `ANTHROPIC_API_KEY` set in Site Settings > Environment Variables. If it's already set, you don't need to touch it.

## Having Claude do it for you

Say: "Update the web app system prompt to match the latest references" and Claude can read the current reference files, update `system-prompt.mjs`, and save it. You then just deploy.
