#!/usr/bin/env node
// ============================================================================
// StudioNow Script Creator — Before/After Comparison
// ============================================================================
//
// Usage:
//   node tests/compare.mjs                  # Compare two most recent runs
//   node tests/compare.mjs 2026-03-19_14-30 2026-03-19_16-45  # Compare specific runs
//
// ============================================================================

import { readFileSync, readdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const resultsDir = resolve(__dirname, "results");

// ---------------------------------------------------------------------------
// Find runs to compare
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
let run1, run2;

if (args.length >= 2) {
  run1 = args[0];
  run2 = args[1];
} else {
  // Get two most recent
  if (!existsSync(resultsDir)) {
    console.error("No results directory. Run tests first: node tests/run.mjs");
    process.exit(1);
  }
  const runs = readdirSync(resultsDir).filter(d => !d.startsWith(".")).sort();
  if (runs.length < 2) {
    console.error(`Need at least 2 test runs to compare. Found ${runs.length}. Run tests again after making changes.`);
    process.exit(1);
  }
  run1 = runs[runs.length - 2];
  run2 = runs[runs.length - 1];
}

const dir1 = resolve(resultsDir, run1);
const dir2 = resolve(resultsDir, run2);

if (!existsSync(dir1) || !existsSync(dir2)) {
  console.error(`Run directory not found. Available: ${readdirSync(resultsDir).join(", ")}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Load scores
// ---------------------------------------------------------------------------
function loadScores(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith(".score.json"));
  const scores = {};
  for (const f of files) {
    const id = f.replace(".score.json", "");
    try {
      scores[id] = JSON.parse(readFileSync(resolve(dir, f), "utf-8"));
    } catch {
      scores[id] = null;
    }
  }
  return scores;
}

const scores1 = loadScores(dir1);
const scores2 = loadScores(dir2);

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------
const allIds = [...new Set([...Object.keys(scores1), ...Object.keys(scores2)])].sort();

console.log(`\n${"=".repeat(64)}`);
console.log(`  Before/After Comparison`);
console.log(`  BEFORE: ${run1}`);
console.log(`  AFTER:  ${run2}`);
console.log(`${"=".repeat(64)}\n`);

const dimensions = [
  "brief_alignment", "engine_clarity", "runtime_realism", "production_usefulness",
  "language_quality", "emotional_specificity", "format_correctness", "distinctiveness",
];

let totalBefore = 0, totalAfter = 0, count = 0;

for (const id of allIds) {
  const s1 = scores1[id];
  const s2 = scores2[id];

  if (!s1 || !s2) {
    console.log(`  ${id}: ${!s1 ? "missing in BEFORE" : "missing in AFTER"}`);
    continue;
  }

  const diff = s2.total - s1.total;
  const arrow = diff > 0 ? `▲ +${diff}` : diff < 0 ? `▼ ${diff}` : "= 0";
  const emoji = diff > 0 ? "🟢" : diff < 0 ? "🔴" : "⚪";

  console.log(`${emoji} ${id}: ${s1.total}/40 → ${s2.total}/40 (${arrow})`);

  // Show dimension-level changes
  for (const dim of dimensions) {
    const v1 = s1.scores?.[dim]?.score ?? 0;
    const v2 = s2.scores?.[dim]?.score ?? 0;
    const d = v2 - v1;
    if (d !== 0) {
      const label = dim.replace(/_/g, " ").padEnd(24);
      const indicator = d > 0 ? `  ▲ ${label} ${v1} → ${v2}` : `  ▼ ${label} ${v1} → ${v2}`;
      console.log(indicator);
    }
  }

  // Blacklist changes
  const bl1 = s1.blacklist_hits?.length || 0;
  const bl2 = s2.blacklist_hits?.length || 0;
  if (bl1 !== bl2) {
    console.log(`  ${bl2 < bl1 ? "▲" : "▼"} blacklist hits: ${bl1} → ${bl2}`);
  }

  totalBefore += s1.total;
  totalAfter += s2.total;
  count++;
  console.log("");
}

// ---------------------------------------------------------------------------
// Overall
// ---------------------------------------------------------------------------
if (count > 0) {
  const avgBefore = Math.round(totalBefore / count);
  const avgAfter = Math.round(totalAfter / count);
  const overallDiff = avgAfter - avgBefore;
  const overallArrow = overallDiff > 0 ? `▲ +${overallDiff}` : overallDiff < 0 ? `▼ ${overallDiff}` : "= 0";

  console.log("=".repeat(64));
  console.log(`  OVERALL: ${avgBefore}/40 → ${avgAfter}/40 (${overallArrow})`);
  if (overallDiff > 0) {
    console.log("  ✅ Improvement detected");
  } else if (overallDiff < 0) {
    console.log("  ⚠️  Regression detected — review changes");
  } else {
    console.log("  No overall change");
  }
  console.log("=".repeat(64) + "\n");
}
