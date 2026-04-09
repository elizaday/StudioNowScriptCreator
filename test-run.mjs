import { createRequire } from "module";
import { readFileSync } from "fs";

const require = createRequire(
  "/Users/eli/Downloads/StudioNow/Script Auto/studionow-web/package.json"
);
const Anthropic = require("@anthropic-ai/sdk").default;

// Build system prompt
const { buildPrompt } = await import(
  "/Users/eli/Downloads/StudioNow/Script Auto/studionow-web/netlify/functions/system-prompt.mjs"
);
const learningContent = readFileSync(
  "/Users/eli/Downloads/StudioNow/Script Auto/studionow-web/learning.md",
  "utf-8"
);
const systemPrompt = buildPrompt(learningContent);

// API key
const apiKey =
  "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";

const client = new Anthropic({ apiKey });

const userMessage = `Today's date is 3/19/26. Use this as the Date in the script metadata header.

Write a production script from the following brief:

Client: The Coca-Cola Company (Fuze Tea)
Format: 60-120 second sizzle
Genre: Auto-detect

Brief:
1. Objective Create a high energy, modern and inspiring sizzle (60–120 sec) that showcases how Fuze Tea is evolving from a flavorful refreshment brand into a functional wellbeing powerhouse. The video should bring to life the four core innovation pillars: Master of Taste, No Sugar, Natural Invigoration, and Natural Wellness. 2. Core Message — 'Fuze Tea Is Doing MORE.' More flavor superiority, more betterforyou choices, more natural energy, more everyday wellness. Everything ladders to the 3horizon strategy:
* PresentPlay (More Optimization): Master of Taste, Zero Sugar 2.0
* FuturePrep (More Options): Zero Sugar 3.0, Limited Editions
* FutureProof (More Functionality): Natural Invigoration, Natural Wellness
3. How the Four Key Platforms Integrate Into the Sizzle A. MASTER OF TASTE — 'Taste Is King' From the deck: taste is the #1 purchase driver, and Master of Taste innovations consistently deliver superior blind taste vs competitors
* Hero shots of superior prototypes, teainfusion closeups
* 'Turbocharge the core' visual language
* Tone: premium, sensorial, crafted, superior
B. NO SUGAR — '0% Sugar, 100% Taste' Deck insights show No Sugar is the #1 global claim and a top consumer need, with rising sugar concerns across markets. Consumers want healthier choices without compromising taste. Tested claims include: 'The same delightful taste, minus the sugar' 'More Fuze Tea goodness, Zero Sugar' Light, crisp visuals; '0% sugar' floating cues Fast transitions showing Zero Sugar 2.0 and 3.0
* Reassuring voiceover: 'Healthier, without compromising enjoyment.'
C. NATURAL INVIGORATION — 'Clean, Natural Energy' Deck: rising demand for energy, mood boost, mental alertness, and steady natural vitality with a strong FEI size ($88B). Natural Invigoration builds on tea's intrinsic caffeine + botanicals to deliver clean uplift with no crash. Energetic, uplifting movement; bright visual pulses Icons for 'Focus Fuel' and 'Clean Natural Energy'
* Position as the functional engine of the future Fuze Tea
D. NATURAL WELLNESS — 'Balance, Calm, Restore' Deck: Natural Wellness addresses daily wellbeing rituals, including calm, stress relief, sleep, brain health, with a large FEI value ($102B). Designs include relaxing botanical blends and moodmastery cues. Slow, soothing moments; pastel botanicals; warm lighting Shots of calming rituals and 'Selfcare Sips'
* Signals the expanding wellbeing universe of Fuze Tea
4. Story Flow 1. Opening tension: 'People are looking for MORE.' 2. Brand call: 'It is time to do even more with Fuze Tea.' 3. Innovation Strategy: PresentPlay to FuturePrep to FutureProof 4. Master of Taste: Superior flavor uplift 5. No Sugar: Healthier without compromise 6. Natural Invigoration: Clean natural energy 7. Natural Wellness: Everyday calm and balance 8. Full Portfolio Reveal: The future Fuze Tea universe 9. Close: 'Fuze Tea — Doing MORE.' 5. Tone, Look and Feel Modern wellbeing meets sensorial superiority Natural tea cues + botanicals + functional energy iconography Clean, premium, citrusfresh palette with vibrant accents Editing: dynamic for invigoration, soft for wellness
* Always anchored in fusion of tea + fruit + botanicals
6. MustInclude Guardrails and Claims
* Fusion formula (tea + fruit + botanicals)
* Taste superiority proof points (Master of Taste)
* No Sugar 2.0 and 3.0 taste reassurance claims
* FEI territories for Invigoration ($88B) and Wellness ($102B)
* Consumer drivers: sugar reduction, functionality, mood improvement
* Portfolio architecture across Core, Zero Sugar, Functionals
7. Desired Takeaway Fuze Tea is evolving into a global wellbeing leader—anchored in taste, powered by functional benefits, and driven by clear innovation platforms that unlock new consumption occasions and accelerate category growth.`;

console.log("Sending request to Claude API...\n");

const response = await client.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 8192,
  system: systemPrompt,
  messages: [{ role: "user", content: userMessage }],
});

// Print full response
for (const block of response.content) {
  if (block.type === "text") {
    console.log(block.text);
  }
}

console.log("\n--- API Usage ---");
console.log(`Input tokens: ${response.usage.input_tokens}`);
console.log(`Output tokens: ${response.usage.output_tokens}`);
console.log(`Stop reason: ${response.stop_reason}`);
