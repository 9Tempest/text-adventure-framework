import { z } from "zod";

export const VariableValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null()
]);

export const ConditionSchema = z.object({
  key: z.string().min(1),
  op: z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "truthy", "falsy"]),
  value: VariableValueSchema.optional()
});

export const EffectSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("set"), key: z.string().min(1), value: VariableValueSchema }),
  z.object({ type: z.literal("inc"), key: z.string().min(1), by: z.number().default(1) }),
  z.object({ type: z.literal("toggle"), key: z.string().min(1) }),
  z.object({ type: z.literal("unset"), key: z.string().min(1) })
]);

export const SceneCharacterSchema = z.object({
  character: z.string().min(1),
  image: z.string().min(1),
  slot: z.enum(["left", "center", "right"]).default("center"),
  expression: z.string().optional()
});

export const SceneSchema = z.object({
  background: z.string().nullable().optional(),
  music: z.string().nullable().optional(),
  ambience: z.string().nullable().optional(),
  characters: z.array(SceneCharacterSchema).optional(),
  transition: z.enum(["cut", "fade", "dissolve"]).default("fade").optional()
});

const BaseStepSchema = z.object({
  id: z.string().optional(),
  tags: z.array(z.string()).default([]).optional()
});

export const LineStepSchema = BaseStepSchema.extend({
  type: z.literal("line"),
  speaker: z.string().optional(),
  text: z.string().min(1),
  voice: z.string().optional(),
  portrait: z.string().optional(),
  effects: z.array(EffectSchema).default([]).optional()
});

export const SetStepSchema = z.object({
  type: z.literal("set"),
  key: z.string().min(1),
  value: VariableValueSchema
});

export const IncStepSchema = z.object({
  type: z.literal("inc"),
  key: z.string().min(1),
  by: z.number().default(1)
});

export const ToggleStepSchema = z.object({
  type: z.literal("toggle"),
  key: z.string().min(1)
});

export const UnsetStepSchema = z.object({
  type: z.literal("unset"),
  key: z.string().min(1)
});

export const SfxStepSchema = z.object({
  type: z.literal("sfx"),
  audio: z.string().min(1)
});

export const JumpStepSchema = z.object({
  type: z.literal("jump"),
  target: z.string().min(1)
});

export const StepSchema = z.discriminatedUnion("type", [
  LineStepSchema,
  SetStepSchema,
  IncStepSchema,
  ToggleStepSchema,
  UnsetStepSchema,
  SfxStepSchema,
  JumpStepSchema
]);

export const ChoiceSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  target: z.string().min(1),
  conditions: z.array(ConditionSchema).default([]).optional(),
  effects: z.array(EffectSchema).default([]).optional(),
  hint: z.string().optional()
});

export const StoryNodeSchema = z.object({
  id: z.string().min(1),
  title: z.string().optional(),
  scene: SceneSchema.optional(),
  steps: z.array(StepSchema).default([]),
  choices: z.array(ChoiceSchema).default([]).optional(),
  next: z.string().optional()
});

export const CharacterSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  defaultImage: z.string().optional(),
  color: z.string().optional()
});

export const StorySchema = z
  .object({
    version: z.literal(1),
    id: z.string().min(1),
    title: z.string().min(1),
    startNode: z.string().min(1),
    variables: z.record(z.string(), VariableValueSchema).default({}),
    characters: z.array(CharacterSchema).default([]),
    nodes: z.array(StoryNodeSchema).min(1)
  })
  .superRefine((story, ctx) => {
    const nodeIds = new Set(story.nodes.map((node) => node.id));
    if (!nodeIds.has(story.startNode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startNode"],
        message: `startNode '${story.startNode}' does not match any node id`
      });
    }

    for (const node of story.nodes) {
      if (node.next && !nodeIds.has(node.next)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nodes", node.id, "next"],
          message: `Node '${node.id}' next '${node.next}' does not exist`
        });
      }

      for (const step of node.steps) {
        if (step.type === "jump" && !nodeIds.has(step.target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["nodes", node.id, "steps"],
            message: `Node '${node.id}' jumps to missing target '${step.target}'`
          });
        }
      }

      for (const choice of node.choices ?? []) {
        if (!nodeIds.has(choice.target)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["nodes", node.id, "choices", choice.id, "target"],
            message: `Choice '${choice.id}' targets missing node '${choice.target}'`
          });
        }
      }
    }
  });

export const ImageAssetSchema = z.object({
  src: z.string().min(1),
  alt: z.string().optional(),
  tags: z.array(z.string()).default([]).optional()
});

export const AudioAssetSchema = z.object({
  src: z.string().min(1),
  kind: z.enum(["music", "voice", "sfx", "ambience"]),
  loop: z.boolean().default(false).optional(),
  volume: z.number().min(0).max(1).default(1).optional(),
  tags: z.array(z.string()).default([]).optional()
});

export const AssetManifestSchema = z.object({
  version: z.literal(1),
  images: z.record(z.string(), ImageAssetSchema).default({}),
  audio: z.record(z.string(), AudioAssetSchema).default({})
});

export const StoryCatalogEntrySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  storyUrl: z.string().min(1),
  manifestUrl: z.string().min(1).default("/game/assets/manifest.json"),
  tags: z.array(z.string()).default([]).optional()
});

export const StoryCatalogSchema = z
  .object({
    version: z.literal(1),
    defaultStory: z.string().min(1),
    stories: z.array(StoryCatalogEntrySchema).min(1)
  })
  .superRefine((catalog, ctx) => {
    const storyIds = new Set(catalog.stories.map((story) => story.id));
    if (!storyIds.has(catalog.defaultStory)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["defaultStory"],
        message: `defaultStory '${catalog.defaultStory}' does not match any catalog story id`
      });
    }
  });

export type VariableValue = z.infer<typeof VariableValueSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type Effect = z.infer<typeof EffectSchema>;
export type Scene = z.infer<typeof SceneSchema>;
export type SceneCharacter = z.infer<typeof SceneCharacterSchema>;
export type Step = z.infer<typeof StepSchema>;
export type LineStep = z.infer<typeof LineStepSchema>;
export type Choice = z.infer<typeof ChoiceSchema>;
export type StoryNode = z.infer<typeof StoryNodeSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type Story = z.infer<typeof StorySchema>;
export type ImageAsset = z.infer<typeof ImageAssetSchema>;
export type AudioAsset = z.infer<typeof AudioAssetSchema>;
export type AssetManifest = z.infer<typeof AssetManifestSchema>;
export type StoryCatalogEntry = z.infer<typeof StoryCatalogEntrySchema>;
export type StoryCatalog = z.infer<typeof StoryCatalogSchema>;
