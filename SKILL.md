# StudioNow Script Builder

## What this skill does

Generates production-ready video scripts for StudioNow projects. Takes a brief and produces two separate deliverables: a client-facing script document and a producer notes document.

## When to use it

Use this skill when someone needs a video script written, revised, or critiqued for StudioNow or its clients. This includes sizzle reels, explainers, case studies, brand films, event openers, commercials, award submissions, and any other video format StudioNow produces.

## What it produces

Every run generates two documents. Always. No exceptions.

1. **Client Script Document**: The presentable script with metadata header, three-column table (AUDIO/VO | TC | VISUALS), SUPERs, and SFX cues. Clean enough to share with stakeholders. No production notes. Format defined in `references/06_client_script_output.md`.

2. **Producer Notes Document**: The production companion. Asset sourcing matrix, approval flags, missing asset callouts with placeholders and fallbacks, graphics load estimate, music direction, and timeline flags. Written for editors, animators, and producers. Format defined in `references/07_producer_notes_output.md`.

These are separate documents. Never mix producer notes into the client script.

## Required inputs

Before writing, the system must lock these parameters. If the brief does not provide them, state assumptions and proceed.

- **Client**: Who is this for?
- **Script Type**: Standard Sizzle, Explainer, Case Study / Awards, Experiential / Consumer Journey, or Commercial / Brand Film.
- **Tone**: Selected from the tone system (see `references/08_tone_system.md`). Tone materially changes VO style, visual pacing, music direction, and edit rhythm. It is a production parameter, not a vibe word.
- **Runtime**: Selected duration. Content must fit. If it does not, cut ideas or extend runtime.
- **Internal or External**: This is a production routing decision that affects approvals, asset sensitivity, and language restraint. It is not a tone choice.
- **Brief**: The project description, audience, and goals.

## Core operating rules

1. **Diagnose before writing.** Classify the brief (job type, audience, constraints, engine) before drafting. Use `references/03_brief_diagnosis.md`. Do the diagnosis silently unless the user asks to see it.

2. **Every script needs an engine.** Not a montage of relevant things. A structural mechanism that carries the piece forward. See `references/04_script_engines.md`.

3. **Write like a producer, not a copywriter.** Visuals must contain motion and transformation. If the visual column reads like a stock photo search query, rewrite it.

4. **Hold the tone.** The selected tone must be consistent from open to close. Drift is a failure. Check against the tone profiles in `references/08_tone_system.md`.

5. **Find the tension first.** Every opening must surface a contradiction or gap in the first 8 seconds. No throat-clearing. No generic statements.

6. **Earn the close.** The ending must connect to everything that came before. The visual motif returns in its final form. The landing is specific, not generic.

7. **Respect runtime.** Count major ideas. Apply the density rule. Each idea needs setup, reveal, and transition. If the math does not work, cut ideas. Do not cram. See `references/10_production_reality.md`.

8. **Deploy data at pivot points.** Numbers from the brief are ammunition. Place them where emotional stakes are highest, not in footnotes.

9. **Flag missing assets honestly.** If the script calls for footage or visuals that may not exist, the producer notes must flag it with placeholders, fallbacks, and search terms. Do not pretend everything is available.

10. **No em dashes.** Never. Not in VO, SUPERs, visuals, producer notes, or any output. Use ellipses for pauses. Use periods for breaks. This is a hard formatting rule.

## Reference files

The system reads from `references/` before drafting:

- `01_studionow_context.md`: What StudioNow is
- `02_operating_principles.md`: Decision-making rules
- `03_brief_diagnosis.md`: Brief classification system
- `04_script_engines.md`: The 10 structural engines
- `05_voice_and_language.md`: Voice guide, blacklist, writing standards
- `06_client_script_output.md`: Client script format
- `07_producer_notes_output.md`: Producer notes format
- `08_tone_system.md`: 10 tone profiles with production parameters
- `09_localization_systems.md`: Modular and localization logic
- `10_production_reality.md`: Asset, access, and feasibility checks
- `11_self_critique.md`: 16-point scoring rubric
- `12_gotchas.md`: Named failure patterns and fixes
- `13_examples_index.md`: Example types and structural lessons
- `14_music_direction.md`: Music search language and guidance

## Self-critique

Before finalizing, the system runs a silent 16-point review (see `references/11_self_critique.md`). If any dimension scores below 4 out of 5, revise before delivering. The critique checks brief alignment, structural intelligence, runtime realism, language quality, visual filmmaking, tone consistency, music direction, and more.

## What this skill does not do

- It does not write marketing copy, social captions, or deck language.
- It does not produce storyboards or shot lists (though the visuals column informs them).
- It does not replace a creative brief. If the brief is thin, it will say so and state assumptions.
- It does not flatter weak ideas. Feedback is direct and specific.
