import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourcesDir = path.join(root, "tmp/yun-audio-sources");
const buildDir = path.join(root, "tmp/yun-score-build");
const outputDir = path.join(root, "public/game/assets/audio/yun/score");

mkdirSync(buildDir, { recursive: true });
mkdirSync(outputDir, { recursive: true });

const tracks = [
  {
    id: "SCORE_white_tower",
    layers: [{ source: "dark-basement.ogg", offset: 12, volume: 0.82, lowpass: 7600 }]
  },
  {
    id: "SCORE_bells_before_paper",
    layers: [{ source: "aetherbells.ogg", offset: 4, volume: 0.88, highpass: 55, lowpass: 11200 }]
  },
  {
    id: "SCORE_paper_edge",
    layers: [
      { source: "aetherbells.ogg", offset: 86, volume: 0.66, highpass: 45, lowpass: 7200 },
      { source: "endgame.ogg", offset: 42, volume: 0.28, lowpass: 4200 }
    ]
  },
  {
    id: "SCORE_hungry_sea",
    layers: [
      { source: "blue-whale.ogg", offset: 18, volume: 0.78, highpass: 28, lowpass: 6800 },
      { source: "endgame.ogg", offset: 58, volume: 0.24, lowpass: 3600 }
    ]
  },
  {
    id: "SCORE_deep_lantern",
    layers: [
      { source: "blue-whale.ogg", offset: 96, volume: 0.76, highpass: 28, lowpass: 7600 },
      { source: "aetherbells.ogg", offset: 120, volume: 0.2, highpass: 120, lowpass: 9000 }
    ]
  },
  {
    id: "SCORE_three_line_hearing",
    layers: [
      { source: "dark-basement.ogg", offset: 110, volume: 0.76, lowpass: 7000 },
      { source: "aetherbells.ogg", offset: 170, volume: 0.17, highpass: 160, lowpass: 8800 }
    ]
  },
  {
    id: "SCORE_dual_dawn",
    layers: [
      { source: "cold-morning.ogg", offset: 18, volume: 0.82, highpass: 38, lowpass: 11000 },
      { source: "above-the-clouds.ogg", offset: 40, volume: 0.2, highpass: 70, lowpass: 9200 }
    ]
  },
  {
    id: "SCORE_thousand_islands",
    layers: [
      { source: "above-the-clouds.ogg", offset: 110, volume: 0.78, highpass: 34, lowpass: 11800 },
      { source: "aetherbells.ogg", offset: 55, volume: 0.16, highpass: 180, lowpass: 10000 }
    ]
  },
  {
    id: "SCORE_signal_cut",
    layers: [{ source: "endgame.ogg", offset: 80, volume: 0.86, highpass: 32, lowpass: 6200 }]
  },
  {
    id: "SCORE_after_the_warning",
    layers: [
      { source: "endgame.ogg", offset: 150, volume: 0.72, highpass: 30, lowpass: 7000 },
      { source: "cold-morning.ogg", offset: 130, volume: 0.24, highpass: 65, lowpass: 9200 }
    ]
  }
];

for (const track of tracks) {
  const layers = track.layers.map((layer, index) => {
    const output = path.join(buildDir, `${track.id}-${index}.wav`);
    makeCircularLayer(layer, output);
    return output;
  });
  const output = path.join(outputDir, `${track.id}.ogg`);
  masterTrack(layers, output);
  console.log(`built ${path.relative(root, output)}`);
}

rmSync(buildDir, { recursive: true, force: true });

function makeCircularLayer(layer, output) {
  const input = path.join(sourcesDir, layer.source);
  const highpass = layer.highpass ?? 30;
  const lowpass = layer.lowpass ?? 10000;
  const prefix = output.replace(/\.wav$/, "");
  const processed = `${prefix}-processed.wav`;
  const body = `${prefix}-body.wav`;
  const tail = `${prefix}-tail.wav`;
  const head = `${prefix}-head.wav`;
  const seam = `${prefix}-seam.wav`;

  run("ffmpeg", [
    "-y", "-v", "error", "-ss", String(layer.offset), "-t", "78", "-i", input,
    "-af", `aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=${highpass},lowpass=f=${lowpass},volume=${layer.volume}`,
    "-c:a", "pcm_s24le", processed
  ]);
  trim(processed, body, 6, 66);
  trim(processed, tail, 72, 6);
  trim(processed, head, 0, 6);
  run("ffmpeg", [
    "-y", "-v", "error", "-i", tail, "-i", head,
    "-filter_complex", "[0:a][1:a]acrossfade=d=5:c1=qsin:c2=qsin[out]",
    "-map", "[out]", "-c:a", "pcm_s24le", seam
  ]);
  run("ffmpeg", [
    "-y", "-v", "error", "-i", body, "-i", seam,
    "-filter_complex", "[0:a][1:a]concat=n=2:v=0:a=1[out]",
    "-map", "[out]", "-c:a", "pcm_s24le", output
  ]);

  for (const file of [processed, body, tail, head, seam]) rmSync(file, { force: true });
}

function trim(input, output, start, duration) {
  run("ffmpeg", [
    "-y", "-v", "error", "-ss", String(start), "-t", String(duration), "-i", input,
    "-c:a", "pcm_s24le", output
  ]);
}

function masterTrack(layers, output) {
  const args = ["-y", "-v", "error"];
  for (const layer of layers) args.push("-i", layer);
  const mix = layers.length === 1
    ? "[0:a]anull[out]"
    : `${layers.map((_, index) => `[${index}:a]`).join("")}amix=inputs=${layers.length}:duration=first:normalize=0,volume=0.88[out]`;
  args.push(
    "-filter_complex", mix,
    "-map", "[out]",
    "-ar", "48000",
    "-ac", "2",
    "-c:a", "libvorbis",
    "-q:a", "5",
    output
  );
  run("ffmpeg", args);
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${command} failed with status ${result.status}`);
  }
}
