#!/usr/bin/env node
// ============================================================================
// StudioNow Script Creator — Test Runner
// ============================================================================
//
// Usage:
//   node tests/run.mjs                     # Run all briefs
//   node tests/run.mjs award-sprint        # Run one brief by ID
//   node tests/run.mjs --quick             # Run 3 diverse briefs (fast check)
//
// Outputs:
//   tests/results/YYYY-MM-DD_HH-MM/        # Timestamped results folder
//     ├── award-sprint.md                   # Generated script
//     ├── award-sprint.score.json           # Scores + feedback
//     ├── ...
//     └── summary.md                        # Report card
//
// Requires: ANTHROPIC_API_KEY in environment or ../.env in studionow-web
// ============================================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";

const __dirname_early = dirname(fileURLToPath(import.meta.url));
const require = createRequire(resolve(__dirname_early, "../studionow-web/package.json"));
const Anthropic = require("@anthropic-ai/sdk").default;

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Load environment
// ---------------------------------------------------------------------------
function loadEnv() {
  const envPath = resolve(ROOT, "studionow-web/.env");
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, "utf-8").split("\n");
    for (const line of lines) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  }
}
loadEnv();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error("ERROR: ANTHROPIC_API_KEY not found. Set it in environment or studionow-web/.env");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load system prompt (same as web app)
// ---------------------------------------------------------------------------
const { buildPrompt } = await import(resolve(ROOT, "studionow-web/netlify/functions/system-prompt.mjs"));

let learningContent = "";
const learningPath = resolve(ROOT, "studionow-web/learning.md");
if (existsSync(learningPath)) {
  learningContent = readFileSync(learningPath, "utf-8");
}
const SYSTEM_PROMPT = buildPrompt(learningContent);

// ---------------------------------------------------------------------------
// Load briefs and criteria
// ---------------------------------------------------------------------------
const briefs = JSON.parse(readFileSync(resolve(__dirname, "briefs.json"), "utf-8"));
const criteria = readFileSync(resolve(__dirname, "criteria.md"), "utf-8");

// ---------------------------------------------------------------------------
// Parse args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const isQuick = args.includes("--quick");
const specificId = args.find(a => !a.startsWith("--"));

let selectedBriefs;
if (specificId) {
  selectedBriefs = briefs.filter(b => b.id === specificId);
  if (selectedBriefs.length === 0) {
    console.error(`Brief "${specificId}" not found. Available: ${briefs.map(b => b.id).join(", ")}`);
    process.exit(1);
  }
} else if (isQuick) {
  // Pick 3 diverse regression briefs: one weak, one constrained, one high-stakes
  selectedBriefs = [
    briefs.find(b => b.id === "reg-vague-emotion"),
    briefs.find(b => b.id === "reg-still-here"),
    briefs.find(b => b.id === "reg-sustainability"),
  ].filter(Boolean);
} else {
  selectedBriefs = briefs;
}

// ---------------------------------------------------------------------------
// Create results directory
// ---------------------------------------------------------------------------
const now = new Date();
const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
const resultsDir = resolve(__dirname, "results", timestamp);
mkdirSync(resultsDir, { recursive: true });

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
const client = new Anthropic({ apiKey });

// ---------------------------------------------------------------------------
// Generate a script
// ---------------------------------------------------------------------------
async function generateScript(brief) {
  const today = `${now.getMonth() + 1}/${now.getDate()}/${String(now.getFullYear()).slice(-2)}`;
  const userMessage = `Today's date is ${today}. Use this as the Date in the script metadata header.\n\nWrite a production script from the following brief:\n\n${brief.brief}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content.map(c => c.text || "").join("");
  return {
    script: text,
    usage: response.usage,
  };
}

// ---------------------------------------------------------------------------
// Score a script
// ---------------------------------------------------------------------------
async function scoreScript(brief, script) {
  const scoringPrompt = `You are a strict script quality evaluator for StudioNow. You must score honestly — don't be generous.

## Scoring criteria

${criteria}

## The brief

ID: ${brief.id}
Name: ${brief.name}
Expected genre: ${brief.expected_genre}
Target runtime: ${brief.runtime_seconds}s

Full brief:
${brief.brief}

## The script to evaluate

${script}

## Your task

1. Score each of the 12 universal dimensions (1-5). Be harsh. A 3 is average. A 5 is exceptional. The first 8 are core craft. The last 4 are story arc.
2. Score each of the 3 visual filmmaking bonus dimensions (0 or 1 each).
3. Run the blacklist check — list any blacklisted phrases found in the VO/AUDIO column.
4. Run the brief-specific checks for "${brief.id}" — mark each pass or fail with a one-line explanation.
5. Count the VO words and check against the tone's VO density range. Flag if over or under.
6. Calculate the total score (12 dimensions out of 60, plus up to 3 bonus = max 63) and list the top 3 things to improve.

Respond in this exact JSON format (no markdown fencing, just raw JSON):
{
  "scores": {
    "brief_alignment": {"score": 0, "note": ""},
    "engine_clarity": {"score": 0, "note": ""},
    "runtime_realism": {"score": 0, "note": ""},
    "production_usefulness": {"score": 0, "note": ""},
    "language_quality": {"score": 0, "note": ""},
    "emotional_specificity": {"score": 0, "note": ""},
    "format_correctness": {"score": 0, "note": ""},
    "distinctiveness": {"score": 0, "note": ""},
    "opening_tension": {"score": 0, "note": ""},
    "middle_progression": {"score": 0, "note": ""},
    "ending_payoff": {"score": 0, "note": ""},
    "overall_movement": {"score": 0, "note": ""}
  },
  "bonus": {
    "visual_motif": {"score": 0, "note": ""},
    "transitions": {"score": 0, "note": ""},
    "motion_in_visuals": {"score": 0, "note": ""}
  },
  "vo_density": {
    "word_count": 0,
    "runtime_seconds": 0,
    "tone": "",
    "target_range": "",
    "adjusted_target": "",
    "status": "ok | over | under"
  },
  "total": 0,
  "blacklist_hits": [],
  "specific_checks": [
    {"check": "description", "pass": true, "note": ""}
  ],
  "specific_pass_count": 0,
  "specific_total": 0,
  "top_improvements": ["", "", ""]
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: scoringPrompt }],
  });

  const text = response.content.map(c => c.text || "").join("");

  // Extract JSON from response
  try {
    // Try to find JSON in the response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error(`  ⚠ Failed to parse scores for ${brief.id}: ${e.message}`);
  }
  return null;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`  StudioNow Script Creator — Test Run`);
console.log(`  ${timestamp}`);
console.log(`  ${selectedBriefs.length} brief(s) | Model: claude-sonnet-4-20250514`);
console.log(`${"=".repeat(60)}\n`);

const allResults = [];

for (const brief of selectedBriefs) {
  console.log(`▸ ${brief.name} (${brief.id})`);

  // Generate
  process.stdout.write("  Generating script...");
  const { script, usage } = await generateScript(brief);
  console.log(` done (${usage.input_tokens} in / ${usage.output_tokens} out)`);

  // Save script
  writeFileSync(resolve(resultsDir, `${brief.id}.md`), script);

  // Score
  process.stdout.write("  Scoring...");
  const scoreResult = await scoreScript(brief, script);
  console.log(" done");

  if (scoreResult) {
    writeFileSync(resolve(resultsDir, `${brief.id}.score.json`), JSON.stringify(scoreResult, null, 2));

    const total = scoreResult.total;
    const bonusTotal = scoreResult.bonus
      ? (scoreResult.bonus.visual_motif?.score || 0) + (scoreResult.bonus.transitions?.score || 0) + (scoreResult.bonus.motion_in_visuals?.score || 0)
      : 0;
    const baseTotal = total - bonusTotal;
    const pct = Math.round((total / 63) * 100);
    const specificPct = scoreResult.specific_total > 0
      ? Math.round((scoreResult.specific_pass_count / scoreResult.specific_total) * 100)
      : 0;

    const voDensity = scoreResult.vo_density;
    const voStatus = voDensity ? ` | VO: ${voDensity.word_count}w (${voDensity.status})` : '';
    console.log(`  Score: ${baseTotal}/60 + ${bonusTotal}/3 bonus = ${total}/63 (${pct}%) | Specific: ${scoreResult.specific_pass_count}/${scoreResult.specific_total} (${specificPct}%)${voStatus}`);

    if (scoreResult.blacklist_hits.length > 0) {
      console.log(`  ⚠ Blacklist hits: ${scoreResult.blacklist_hits.join(", ")}`);
    }

    allResults.push({
      id: brief.id,
      name: brief.name,
      total,
      baseTotal,
      bonusTotal,
      pct,
      specificPass: scoreResult.specific_pass_count,
      specificTotal: scoreResult.specific_total,
      specificPct,
      blacklistHits: scoreResult.blacklist_hits.length,
      topImprovements: scoreResult.top_improvements,
      scores: scoreResult.scores,
      bonus: scoreResult.bonus,
    });
  } else {
    console.log("  ⚠ Scoring failed — script saved but no scores");
    allResults.push({ id: brief.id, name: brief.name, total: null });
  }

  console.log("");
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
const scored = allResults.filter(r => r.total !== null);
const avgTotal = scored.length > 0
  ? Math.round(scored.reduce((s, r) => s + r.total, 0) / scored.length)
  : 0;
const avgPct = scored.length > 0
  ? Math.round(scored.reduce((s, r) => s + r.pct, 0) / scored.length)
  : 0;

let summary = `# Test Run: ${timestamp}\n\n`;
summary += `**Briefs:** ${selectedBriefs.length} | **Model:** claude-sonnet-4-20250514 | **Avg Score:** ${avgTotal}/63 (${avgPct}%)\n\n`;

// Table
summary += `| Brief | Base/60 | Bonus/3 | Total/63 | % | Specific | Blacklist | Top Issue |\n`;
summary += `|-------|---------|---------|----------|---|----------|-----------|----------|\n`;
for (const r of allResults) {
  if (r.total !== null) {
    summary += `| ${r.name} | ${r.baseTotal}/60 | ${r.bonusTotal}/3 | ${r.total}/63 | ${r.pct}% | ${r.specificPass}/${r.specificTotal} | ${r.blacklistHits} | ${r.topImprovements?.[0] || "—"} |\n`;
  } else {
    summary += `| ${r.name} | FAILED | — | — | — | — | — | Scoring error |\n`;
  }
}

// Dimension breakdown
summary += `\n## Dimension Breakdown\n\n`;
summary += `| Dimension | ${scored.map(r => r.id).join(" | ")} | Avg |\n`;
summary += `|-----------|${scored.map(() => "---").join("|")}|-----|\n`;

const dimensions = [
  "brief_alignment", "engine_clarity", "runtime_realism", "production_usefulness",
  "language_quality", "emotional_specificity", "format_correctness", "distinctiveness",
  "opening_tension", "middle_progression", "ending_payoff", "overall_movement",
];
for (const dim of dimensions) {
  const label = dim.replace(/_/g, " ");
  const vals = scored.map(r => r.scores?.[dim]?.score ?? "—");
  const numVals = vals.filter(v => typeof v === "number");
  const avg = numVals.length > 0 ? (numVals.reduce((s, v) => s + v, 0) / numVals.length).toFixed(1) : "—";
  summary += `| ${label} | ${vals.join(" | ")} | ${avg} |\n`;
}

// Bonus dimensions
summary += `\n## Visual Filmmaking Bonus\n\n`;
summary += `| Bonus | ${scored.map(r => r.id).join(" | ")} | Avg |\n`;
summary += `|-------|${scored.map(() => "---").join("|")}|-----|\n`;
const bonusDimensions = ["visual_motif", "transitions", "motion_in_visuals"];
for (const dim of bonusDimensions) {
  const label = dim.replace(/_/g, " ");
  const vals = scored.map(r => r.bonus?.[dim]?.score ?? "—");
  const numVals = vals.filter(v => typeof v === "number");
  const avg = numVals.length > 0 ? (numVals.reduce((s, v) => s + v, 0) / numVals.length).toFixed(1) : "—";
  summary += `| ${label} | ${vals.join(" | ")} | ${avg} |\n`;
}

// Recurring improvements
summary += `\n## Top Improvements Needed\n\n`;
const allImprovements = scored.flatMap(r => r.topImprovements || []).filter(Boolean);
const improvementCounts = {};
for (const imp of allImprovements) {
  const key = imp.toLowerCase().slice(0, 60);
  improvementCounts[key] = (improvementCounts[key] || 0) + 1;
}
const sortedImprovements = Object.entries(improvementCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
for (const [imp, count] of sortedImprovements) {
  summary += `- (${count}x) ${imp}\n`;
}

summary += `\n---\nResults saved to: tests/results/${timestamp}/\n`;

writeFileSync(resolve(resultsDir, "summary.md"), summary);

console.log("=".repeat(60));
console.log("  SUMMARY");
console.log("=".repeat(60));
console.log(`\n  Average: ${avgTotal}/63 (${avgPct}%)\n`);
for (const r of allResults) {
  const bar = r.total !== null ? "█".repeat(Math.round(r.pct / 5)) + "░".repeat(20 - Math.round(r.pct / 5)) : "— error —";
  console.log(`  ${r.pct !== undefined ? String(r.pct).padStart(3) : "  ?"}%  ${bar}  ${r.id}`);
}
console.log(`\n  Results: tests/results/${timestamp}/summary.md\n`);
