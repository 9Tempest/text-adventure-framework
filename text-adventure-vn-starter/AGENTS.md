# Codex Guidelines for This Project

- Keep `src/engine` framework-agnostic. No React imports inside runtime/schema/save/audio adapters unless absolutely necessary.
- Treat `public/game/story/*.json` and `public/game/assets/manifest.json` as untrusted external content; validate with Zod.
- Add runtime tests for every new `StepSchema` variant.
- Do not hardcode story ids, node ids, or asset ids in UI components except demo defaults.
- Prefer adapters/plugins for side effects: save, audio, analytics, achievements, gallery unlocks.
- Run `npm run validate` after modifying story or manifest.
- Run `npm run test` after modifying runtime behavior.
