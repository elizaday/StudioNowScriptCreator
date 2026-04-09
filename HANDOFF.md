# StudioNow Script Creator — Handoff Guide

## What You're Getting

A private web app that writes production-ready video scripts. Your team opens a URL, fills in the brief, attaches any decks or images, and gets two separate Word docs: a client script and producer notes.

Behind the scenes, it sends every brief through 30,000 tokens of StudioNow writing rules — covering diagnosis, structure, tone, voice, visual filmmaking, music direction, self-critique, and 17 named failure patterns. No one on the team needs to know any of this. They just paste a brief and click Generate.

The system runs on two services:
- **Anthropic** (Claude API) — the AI that writes the scripts. You pay per use (~$0.10-0.30 per script).
- **Netlify** — hosts the web app. Free tier. No cost.

Both accounts are yours. You own everything. Nothing is tied to Eli's machine.

---

## Initial Setup (One Person, ~30 Minutes)

You need someone comfortable with GitHub. This is a one-time setup.

### 1. Create an Anthropic account

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Sign up with a StudioNow email
3. Go to **Settings > API Keys**
4. Click **Create Key**
5. **Do NOT add IP restrictions** — leave the allowlist empty
6. Copy the key somewhere safe (starts with `sk-ant-api03-...`)
7. Go to **Settings > Billing**, add a credit card, load $50

This key is like a password. Don't share it publicly. It goes in Netlify as a private environment variable.

### 2. Create a GitHub repo

1. Go to [github.com](https://github.com) — use a StudioNow org account or personal account
2. Create a new **private** repository called `studionow-script-creator`
3. On your computer, open Terminal and run:

```bash
cd "/path/to/Script Auto"
git init
git add -A
git commit -m "Initial commit — StudioNow Script Creator"
git remote add origin https://github.com/YOUR-ACCOUNT/studionow-script-creator.git
git push -u origin main
```

Replace `YOUR-ACCOUNT` with your actual GitHub username or org.

### 3. Deploy to Netlify

1. Go to [netlify.com](https://netlify.com), sign up (free), connect your GitHub account
2. Click **Add new site > Import from Git**
3. Select your `studionow-script-creator` repo
4. Configure these build settings:
   - **Base directory:** `studionow-web`
   - **Build command:** `node build-prompt.mjs`
   - **Publish directory:** `public`
   - **Functions directory:** `netlify/functions`
5. Click **Deploy**
6. Once deployed, go to **Site settings > Environment variables**
7. Add a new variable:
   - Key: `ANTHROPIC_API_KEY`
   - Value: paste the key from Step 1
8. **Trigger a redeploy** (Deploys > Trigger deploy > Deploy site)

Your app is now live at `https://your-site-name.netlify.app`. Bookmark it. Share the URL with your team. That's it.

---

## Daily Use (For All 5 Producers)

1. Open the URL in any browser
2. Fill in the dropdowns: client, format, tone, runtime
3. Paste the brief into the text area
4. Attach files if you have them (PowerPoint decks, PDFs, images, Word docs)
5. Click **Generate Script**
6. Wait 30-60 seconds
7. Two sections appear: **Client Script** and **Producer Notes**
8. Download each as a separate Word doc using the download buttons

### Tips for better output

- **More detail = better scripts.** A two-sentence brief gets a generic script. A brief with audience, placement, tone, existing assets, and key metrics gets a sharp one.
- **Attach the strategy deck.** The system mines PowerPoints for data, audience language, frameworks, and visual references. The more it has, the better it writes.
- **Use the tone dropdown.** Each tone changes how much voiceover fills the runtime. "Emotion-Driven" leaves space for visuals. "Direct/Informational" packs in more VO.
- **The first draft is a starting point.** Use it as a v1 to react to, not a final deliverable.

---

## Updating the Writing System

This is the real power of the tool. The writing rules are plain text files. Anyone can edit them. When you push changes, the app rebuilds automatically.

### Where the rules live

```
Script Auto/
├── CLAUDE.md                         ← Master rules (diagnosis, formatting, critique)
└── references/
    ├── 01_studionow_context.md       ← What StudioNow is
    ├── 02_operating_principles.md    ← Decision-making rules
    ├── 03_brief_diagnosis.md         ← How briefs get classified
    ├── 04_script_engines.md          ← The 10 structural engines
    ├── 05_voice_and_language.md      ← Voice guide, blacklist, writing rules
    ├── 06_client_script_output.md    ← Client script format and asset rules
    ├── 07_producer_notes_output.md   ← Producer notes format (8 required sections)
    ├── 08_tone_system.md             ← 9 tones with VO density percentages
    ├── 09_localization_systems.md    ← Modular and localization logic
    ├── 10_production_reality.md      ← Asset, access, and feasibility checks
    ├── 11_self_critique.md           ← 23-point self-review rubric
    ├── 12_gotchas.md                 ← 17 named failure patterns with fixes
    ├── 13_examples_index.md          ← Example types index
    ├── 14_music_direction.md         ← Music guidance and licensing language
    └── 15_story_arc_system.md        ← Narrative spine and three-part arc system
```

### How to make a change

**Example: You want to add a new blacklisted phrase**

1. Open `references/05_voice_and_language.md` in any text editor
2. Add the phrase to the blacklist section
3. Save
4. In Terminal:

```bash
cd "/path/to/Script Auto"
git add references/05_voice_and_language.md
git commit -m "Add new blacklisted phrase"
git push
```

5. Netlify auto-deploys within 60 seconds. Done. Every script from now on follows the new rule.

**Example: You want to add a new tone**

1. Open `references/08_tone_system.md`
2. Add the new tone profile following the existing format (name, description, VO density, sentence behavior, music direction)
3. Save, commit, push

**Example: You want to add a new failure pattern**

1. Open `references/12_gotchas.md`
2. Add a new numbered section with Symptom, Why it happens, and Fix
3. Save, commit, push

**Example: You want to add an entirely new reference file**

1. Create `references/16_your_topic.md` with the content
2. Add a reference to it in `CLAUDE.md` under the "Reference files" section
3. Save both files, commit, push
4. The build script automatically picks up all `.md` files in `references/`

### Who should make updates

Anyone who writes or reviews scripts. The files are plain English — not code. If you can write a brief, you can edit a reference file. The only technical step is the git commit/push, which one person can own.

**Recommended cadence:** Review after every 10-20 scripts generated. Note patterns ("it keeps doing X") and add a gotcha or update a rule.

---

## What Each File Actually Controls

| If you want to change... | Edit this file |
|--------------------------|---------------|
| How the system diagnoses a brief before writing | `03_brief_diagnosis.md` |
| What structural patterns are available (relay, reveal, countdown, etc.) | `04_script_engines.md` |
| Which words and phrases are banned | `05_voice_and_language.md` |
| How the three-column script table is formatted | `06_client_script_output.md` |
| What sections the producer notes must include | `07_producer_notes_output.md` |
| How much voiceover fills the runtime per tone | `08_tone_system.md` |
| What the system checks before finalizing a script | `11_self_critique.md` |
| Known failure patterns and how to prevent them | `12_gotchas.md` |
| How music direction is written | `14_music_direction.md` |
| How the narrative arc works (tension > shift > outcome) | `15_story_arc_system.md` |
| The master rules that govern everything | `CLAUDE.md` |

---

## Costs

| Service | Cost | Notes |
|---------|------|-------|
| Anthropic API | ~$0.10-0.30 per script | $50 covers ~170-500 scripts. Monitor at console.anthropic.com |
| Netlify hosting | $0 | Free tier. 125K function calls/month (you'll use ~100-200) |
| GitHub | $0 | Free for private repos |

**Monthly estimate for 5 producers generating ~50 scripts/month:** $5-15/month on API costs.

---

## Troubleshooting

**"Generation failed"**
Check that `ANTHROPIC_API_KEY` is set correctly in Netlify: Site settings > Environment variables. Make sure the key has no IP restrictions. Trigger a redeploy after changing the key.

**Scripts are too long / too short**
Check `references/08_tone_system.md` — each tone has a VO density percentage that controls word count. Adjust the range for the tone you're using.

**Scripts keep making the same mistake**
Add it to `references/12_gotchas.md` as a new numbered pattern. Give it a name, describe the symptom, explain why it happens, and write the fix. Push to GitHub.

**Output doesn't split into two documents**
The model needs to output a `---` separator followed by `## Producer Notes`. Check `references/06_client_script_output.md` — the separation rules are there. If the model ignores them, add emphasis to the rule.

**Want to test changes before deploying**
Run locally:
```bash
cd "Script Auto/studionow-web"
node build-prompt.mjs    # rebuilds the combined prompt
node server.mjs          # starts local server at http://localhost:8888
```
Requires Node.js installed and an API key in `studionow-web/.env` file formatted as:
```
ANTHROPIC_API_KEY=sk-ant-api03-your-key-here
```

---

## Running the Test Suite (Optional)

There's an automated test that runs 10 briefs through the system and scores the output:

```bash
cd "Script Auto"
node tests/run.mjs --quick    # 3 briefs, fast check
node tests/run.mjs            # full 10-brief suite
```

This requires Node.js and the Anthropic API key set as an environment variable. Results save to `tests/results/` with scores and a report card.

---

## Architecture (For the Technical Person)

```
Script Auto/
├── CLAUDE.md                    ← Master instructions
├── HANDOFF.md                   ← This document
├── .gitignore                   ← Keeps .env and node_modules out of git
├── references/                  ← 15 reference files (the writing brain)
│   ├── 01_studionow_context.md
│   ├── ...
│   └── 15_story_arc_system.md
├── studionow-web/               ← The web app
│   ├── build-prompt.mjs         ← Combines CLAUDE.md + 15 refs into one file
│   ├── server.mjs               ← Local dev server (optional)
│   ├── netlify.toml             ← Netlify deploy config
│   ├── package.json             ← Dependencies
│   ├── .env                     ← Local API key (NOT in git)
│   ├── full-prompt.md           ← Auto-generated combined prompt (NOT in git)
│   ├── learning.md              ← Accumulated team feedback
│   ├── public/                  ← Frontend
│   │   └── index.html           ← The entire UI (single file)
│   └── netlify/functions/       ← Backend API
│       ├── generate.mjs         ← Main script generation endpoint
│       ├── refine.mjs           ← Script refinement endpoint
│       └── feedback.mjs         ← Feedback collection endpoint
└── tests/                       ← Regression test suite
    ├── run.mjs                  ← Test runner
    ├── briefs.json              ← 18 test briefs
    └── criteria.md              ← Scoring criteria
```

### How a request flows

1. Producer fills in the form and clicks Generate
2. Frontend extracts text and images from any attached files (PPTX, PDF, DOCX)
3. Frontend sends the brief + extracted content to `/api/generate`
4. `generate.mjs` loads `full-prompt.md` (all 15 reference files combined) as the system prompt
5. Sends the system prompt + brief + attachments to the Claude API
6. Claude streams the response back
7. Frontend splits the stream into Client Script and Producer Notes sections
8. Producer downloads each as a separate Word document

### How updates flow

1. Someone edits a `.md` file and pushes to GitHub
2. Netlify detects the push and runs `build-prompt.mjs`
3. `build-prompt.mjs` reads CLAUDE.md + all 15 reference files and combines them into `full-prompt.md`
4. Netlify deploys the new version
5. Next script generated uses the updated rules

No server restarts. No manual steps. Push and it's live.
