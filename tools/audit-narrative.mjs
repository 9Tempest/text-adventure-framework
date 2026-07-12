import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const storyPath = path.resolve(root, process.argv[2] ?? "public/game/story/yun-tianming-three-fables.story.json");
const story = JSON.parse(readFileSync(storyPath, "utf8"));
const nodes = new Map(story.nodes.map((node) => [node.id, node]));
const errors = [];

const nextIds = (node) => [
  ...(node.next ? [node.next] : []),
  ...(node.choices ?? []).map((choice) => choice.target)
];

const reachable = new Set();
const stack = [story.startNode];
while (stack.length) {
  const id = stack.pop();
  if (reachable.has(id)) continue;
  reachable.add(id);
  const node = nodes.get(id);
  if (node) stack.push(...nextIds(node));
}

for (const id of nodes.keys()) {
  if (!reachable.has(id)) errors.push(`Unreachable node: ${id}`);
}

const seenLines = new Map();
let lineCount = 0;
let choiceCount = 0;
for (const node of story.nodes) {
  const choiceTexts = new Set();
  for (const step of node.steps) {
    if (step.type !== "line") continue;
    lineCount += 1;
    const length = Array.from(step.text).length;
    if (length > 105) errors.push(`Line too long (${length}) at ${node.id}: ${step.text}`);
    const previous = seenLines.get(step.text);
    if (previous) errors.push(`Duplicate line at ${node.id} and ${previous}: ${step.text}`);
    seenLines.set(step.text, node.id);
  }
  for (const choice of node.choices ?? []) {
    choiceCount += 1;
    if (!choice.hint) errors.push(`Choice has no hint at ${node.id}: ${choice.id}`);
    if (choiceTexts.has(choice.text)) errors.push(`Duplicate choice text at ${node.id}: ${choice.text}`);
    choiceTexts.add(choice.text);
  }
}

function assertWaypoint(start, destinations, waypoint, ignored = new Set()) {
  const pending = [[start, start === waypoint]];
  const visited = new Set();
  while (pending.length) {
    const [id, passed] = pending.pop();
    const stateKey = `${id}:${passed}`;
    if (visited.has(stateKey)) continue;
    visited.add(stateKey);
    if (destinations.has(id) && !passed) {
      errors.push(`Path reaches ${id} from ${start} without required waypoint ${waypoint}`);
      continue;
    }
    if (ignored.has(id)) continue;
    const node = nodes.get(id);
    if (!node) continue;
    for (const next of nextIds(node)) pending.push([next, passed || next === waypoint]);
  }
}

if (story.id === "yun-tianming-three-fables") {
  assertWaypoint("T1_01", new Set(["T2_01"]), "T1_07", new Set(["E_CENSOR"]));
  assertWaypoint(
    "T3_01",
    new Set(["T3_04", "T3_05", "T3_06", "T3_07", "T3_08", "T3_09", "T3_10", "R02"]),
    "T3_02"
  );
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`OK: ${story.title} — ${story.nodes.length} nodes, ${lineCount} lines, ${choiceCount} choices, all narrative checks passed.`);
}
