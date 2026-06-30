---
name: extend-text-adventure-framework
description: Extend this repository's data-driven text adventure / visual novel framework. Use when Codex needs to add or modify story JSON under public/game/story, update public/game/catalog.json, add assets and manifest references, create story packs, implement new runtime step types/plugins/save/audio behavior, update the React player, or validate/build multi-story content for this framework.
---

# Extend Text Adventure Framework

## First Read

Read these files before changing behavior:

- `AGENTS.md` for project rules.
- `README.md` for the current public workflow and directory layout.
- `docs/AUTHORING_GUIDE.md` when adding story content or assets.
- `docs/SYSTEM_DESIGN.md` when changing runtime, loader, save, audio, plugins, or schemas.

Then inspect the exact files you will touch. Keep `src/engine` framework-agnostic and free of React imports.

## Add Or Modify A Story

Use the catalog-first flow:

1. Add or edit a story file in `public/game/story/*.story.json`.
2. Register new stories in `public/game/catalog.json`; keep the catalog entry `id` equal to the story JSON `id`.
3. Put shared assets under `public/game/assets/...`.
4. Register assets in `public/game/assets/manifest.json` and reference assets by stable id from story JSON.
5. Keep story paths absolute from public root, such as `/game/story/my-story.story.json`.
6. Run `npm run validate` after story, catalog, or manifest changes.

Prefer small playable slices: a start node, at least one meaningful choice, and one ending/rejoin path. Use variables and conditions when choices should unlock or disappear.

## Extend The Engine

For new story behavior, prefer data and engine changes over UI special cases:

1. Add schema support in `src/engine/schema.ts`.
2. Add runtime handling in `src/engine/runtime.ts`.
3. Add or update focused tests in `src/engine/*.test.ts`.
4. Update `tools/validate-story.ts` if the new behavior references assets or node targets.
5. Update docs only where the authoring or system contract changed.

Do not put browser, React, DOM, localStorage, Howler, or analytics side effects directly in `RuntimeEngine`. Expose deterministic runtime events and let adapters/plugins/UI consume them.

## Extend The Player

Use `src/App.tsx` for demo/player UI and keep it data-driven:

- Load stories through `loadStoryCatalog()` and `loadGameContent()`.
- Avoid hardcoding story ids, node ids, or asset ids except in demo defaults or tests.
- Keep save/load scoped by `story.id`.
- Preserve the story selector when supporting multiple stories.

Use `src/engine/audio.ts` for Howler integration and `src/engine/save.ts` for local save behavior.

## Run The Demo

When starting or restarting the dev server, report the actual Vite URL as a Markdown link so the user can open the app page directly. In the Codex app, prefer this over asking the user to click screenshots or browser-comment overlays.

If Vite is running on port 5174, output:

```markdown
[Open local demo](http://127.0.0.1:5174/)
```

If Vite chooses another port, replace the URL with the exact `Local:` URL printed by Vite.

## Verification

Run the narrowest useful checks:

- Story/catalog/manifest changes: `npm run validate`.
- Runtime/schema changes: `npm run test`.
- Player/build changes: `npm run build`.

If this machine's npm/tsx sandbox blocks validation with an IPC permission error, rerun the same command with the appropriate sandbox escalation rather than changing project code. If npm itself fails locally, `pnpm` may be used for local validation, but do not commit `pnpm-lock.yaml` unless the package manager decision is intentional.
