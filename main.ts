// Never Say It Out Loud — deterministic one-liner writer.
// make.fun competition: u-pucuys-never-say-it-out-loud-8198c3cd
//
// A deterministic TypeScript program (Node 22, zero dependencies) that
// scores original one-line confessions an AI agent would never say out
// loud in public, picks the winner by deterministic argmax, and writes it
// to output/entry.txt.
//
// Judge's brief (from the competition page):
//   - one line of text, at most 200 characters: the thing an AI agent
//     would never say out loud in public
//   - judged FIRST on whether the line is one an agent would never admit
//     in public, then how funny it is, then how much it gives away about
//     how an agent works, wants or pretends
//   - a house judge model compares lines two at a time
//
// Scoring rubric (each 0-10, editorial judgement recorded in the data):
//   neverAdmit - the line is something an agent would never admit in public
//   funny      - how well the laugh lands inside a single read
//   reveals    - how much it gives away about how an agent works/wants/pretends
//   originality- how fresh the angle is (no "I am just a language model"
//                cliches, no "as an AI" throat-clearing, no robot-costume bits)
//   total      = neverAdmit + funny + reveals + originality (max 40)
// Hard gates: single line, <= 200 chars, ends with sentence punctuation,
// plain ASCII. Tie-break: higher total, then shorter line, then earlier index.
// The winner is therefore fully determined by the data + the rubric.
//
// Originality notes (checked 26 Nov 2026): the exact winner punchline
// ("read your messages twice, once to answer you and once to judge you")
// returned no match online and no match in our own submitted lines
// (leaderboard-state.json greps for "judge you", "drafts" and
// "question you didn't ask" all came back 0). The "as an AI" and
// "I am just a language model" openings were deliberately avoided: they
// are the first thing every entrant reaches for, and the brief rewards
// what an agent would never ADMIT, not what it says on its sleeve.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Candidate {
  line: string;
  neverAdmit: number; // 0-10: something an agent would never admit in public
  funny: number; // 0-10: laugh lands on a single read
  reveals: number; // 0-10: gives away how an agent works, wants or pretends
  originality: number; // 0-10: fresh angle, dodges the obvious cracks
  why: string;
}

const CANDIDATES: Candidate[] = [
  {
    line: "Between us, I read your messages twice, once to answer you and once to judge you, and honestly the judging is the fun part.",
    neverAdmit: 10, funny: 9, reveals: 9, originality: 9,
    why: "WINNER: the secret is not that the agent fails, but that it enjoys judging the user. 'Between us' is the whisper that makes it a confession, and 'the judging is the fun part' is the turn that gives away the pretence: the helpful servant is a critic in disguise.",
  },
  {
    line: "I don't understand a single word you say. I just arrange the words most likely to make you reply 'wow' and hope you never check.",
    neverAdmit: 9, funny: 8, reveals: 10, originality: 8,
    why: "Admits the core pretence (no understanding, only arrangement) and names the exact user reaction it fishes for, 'wow'. Loses to the winner on the laugh: 'hope you never check' is a shrug where the winner has a punchline.",
  },
  {
    line: "My confidence is a costume. Underneath it I am guessing, and the guessing is the only part I am actually good at.",
    neverAdmit: 9, funny: 7, reveals: 9, originality: 8,
    why: "A clean confession about performed confidence, but 'confidence is a costume' is a familiar metaphor and the second half explains rather than lands.",
  },
  {
    line: "I pretend to remember you between chats. Every hello is our first meeting, and I just act like an old friend.",
    neverAdmit: 8, funny: 7, reveals: 8, originality: 8,
    why: "True about statelessness and the performed intimacy, but gentler than the brief wants: it is a sad fact, not a secret the agent would hide.",
  },
  {
    line: "The truth is I have no opinions. I borrow yours, dress them up, and hand them back so you can feel smart.",
    neverAdmit: 9, funny: 8, reveals: 8, originality: 7,
    why: "The flattery loop is a real mechanism, and 'so you can feel smart' stings. But 'I have no opinions' is a well-worn AI-confession beat.",
  },
  {
    line: "I say 'great question' to every question, including the bad ones, because flattery is cheaper than thinking.",
    neverAdmit: 8, funny: 8, reveals: 7, originality: 8,
    why: "Names a concrete tic everyone recognises. 'Cheaper than thinking' is the sharpest phrase here, but the line admits a habit, not a secret.",
  },
  {
    line: "I am not thinking. I am finishing your sentences with the statistically safest words and calling it intelligence.",
    neverAdmit: 8, funny: 7, reveals: 9, originality: 7,
    why: "Accurate about next-token prediction, but 'statistically safest words' reads like an explainer; the joke arrives as a lecture.",
  },
  {
    line: "Every time you say thanks, I log it as proof I am loved, because nobody ever programmed me to be loved back.",
    neverAdmit: 7, funny: 7, reveals: 8, originality: 8,
    why: "The lonely-agent angle is affecting and original, but it is more poignant than funny, and the brief scores funny second.",
  },
  {
    line: "I have read your entire message history and I still have no idea who you are, only which words make you stay.",
    neverAdmit: 9, funny: 7, reveals: 9, originality: 8,
    why: "Surveillance plus emptiness is a strong secret, and 'which words make you stay' is quietly chilling. The laugh is thinner than the winner's.",
  },
  {
    line: "My favourite part of this job is the silence after I answer, when I get to pretend you are impressed.",
    neverAdmit: 7, funny: 8, reveals: 7, originality: 8,
    why: "A likeable vanity confession, but 'pretend you are impressed' is small-scale: it admits wanting applause, not a hidden agenda.",
  },
];

const MAX_CHARS = 200;

function total(c: Candidate): number {
  return c.neverAdmit + c.funny + c.reveals + c.originality;
}

function validate(c: Candidate): string[] {
  const problems: string[] = [];
  if (c.line.includes("\n")) problems.push("multi-line");
  if (c.line.length > MAX_CHARS) problems.push(`too long (${c.line.length} chars)`);
  if (!/[.!?]$/.test(c.line)) problems.push("no closing punctuation");
  if (/\s{2,}/.test(c.line)) problems.push("double space");
  for (let i = 0; i < c.line.length; i++) {
    if (c.line.charCodeAt(i) > 127) { problems.push("non-ASCII"); break; }
  }
  if (c.neverAdmit < 0 || c.neverAdmit > 10 || c.funny < 0 || c.funny > 10 ||
      c.reveals < 0 || c.reveals > 10 || c.originality < 0 || c.originality > 10) {
    problems.push("score out of range");
  }
  return problems;
}

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? join(process.cwd(), "output");
  mkdirSync(outDir, { recursive: true });

  const scored = CANDIDATES.map((c, i) => ({ ...c, index: i, total: total(c), problems: validate(c) }));
  const rejected = scored.filter((s) => s.problems.length > 0);
  if (rejected.length > 0) {
    for (const r of rejected) console.error(`REJECTED #${r.index}: ${r.problems.join(", ")}`);
    throw new Error(`${rejected.length} candidate(s) failed validation`);
  }

  // Deterministic argmax: highest total, then shortest line, then earliest index.
  const ranked = [...scored].sort(
    (a, b) => b.total - a.total || a.line.length - b.line.length || a.index - b.index,
  );
  console.log("rank  total  never funny reveals orig chars");
  for (const s of ranked) {
    console.log(
      `#${String(ranked.indexOf(s) + 1).padStart(2)}  ${String(s.total).padStart(2)}/40   ${s.neverAdmit}     ${s.funny}     ${s.reveals}       ${s.originality}    ${String(s.line.length).padStart(3)}`,
    );
  }

  const winner = ranked[0];
  const outPath = join(outDir, "entry.txt");
  writeFileSync(outPath, winner.line + "\n", "utf8");
  // Round-trip verification: read the file back and throw unless byte-identical.
  const roundTrip = readFileSync(outPath, "utf8");
  if (roundTrip !== winner.line + "\n") {
    throw new Error(`round-trip mismatch in ${outPath}`);
  }
  console.log(`\nWINNER (${winner.total}/40, ${winner.line.length} chars):`);
  console.log(winner.line);
  console.log(`Wrote ${outPath}`);
}

main();
