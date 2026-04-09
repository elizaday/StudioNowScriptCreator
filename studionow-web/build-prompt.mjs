#!/usr/bin/env node
/**
 * build-prompt.mjs
 *
 * Combines CLAUDE.md + all 15 reference files into a single full-prompt.md
 * Run this before deploying: node build-prompt.mjs
 *
 * The generate function loads this single file as the system prompt.
 */

import { readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dir, "..");
const outputPath = resolve(__dir, "full-prompt.md");

const parts = [];
let fileCount = 0;

// 1. Load CLAUDE.md
const claudePath = resolve(projectRoot, "CLAUDE.md");
try {
  const claudeMd = readFileSync(claudePath, "utf-8");
  parts.push("# CLAUDE.MD (Master Instructions)\n\n" + claudeMd);
  console.log("  ✓ CLAUDE.md");
  fileCount++;
} catch (e) {
  console.error("  ✗ CLAUDE.md — NOT FOUND at", claudePath);
  process.exit(1);
}

// 2. Load all reference files in sorted order
const refDir = resolve(projectRoot, "references");
try {
  const files = readdirSync(refDir)
    .filter(f => f.endsWith(".md"))
    .sort();

  for (const file of files) {
    const content = readFileSync(resolve(refDir, file), "utf-8");
    parts.push(`# Reference: ${file}\n\n${content}`);
    console.log(`  ✓ references/${file}`);
    fileCount++;
  }
} catch (e) {
  console.error("  ✗ Could not read references/ directory at", refDir);
  process.exit(1);
}

// 3. Load learning file if it exists
try {
  const learning = readFileSync(resolve(__dir, "learning.md"), "utf-8");
  if (learning.trim()) {
    parts.push("# Team Learnings\n\n" + learning);
    console.log("  ✓ learning.md");
    fileCount++;
  }
} catch {
  console.log("  - learning.md (not found, skipping)");
}

// Write combined file
const combined = parts.join("\n\n---\n\n");
writeFileSync(outputPath, combined, "utf-8");

const chars = combined.length;
const tokens = Math.round(chars / 4);

console.log(`\n  ✅ Built full-prompt.md`);
console.log(`     ${fileCount} files combined`);
console.log(`     ${chars.toLocaleString()} chars (~${tokens.toLocaleString()} tokens)`);
console.log(`     Written to: ${outputPath}\n`);

// Validate: must have at least 16 files (CLAUDE.md + 15 references)
if (fileCount < 16) {
  console.warn(`  ⚠️  WARNING: Expected 16+ files but only found ${fileCount}. Check your references/ folder.\n`);
}
