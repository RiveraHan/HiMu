import type { CreativeProductionPlanV1 } from "./creative-generation.ts";

export type VisualPurpose = "cover" | "avatar";
export type VisualPlan = CreativeProductionPlanV1["visual"];

export type VisualDirection = VisualPlan & {
  purpose: VisualPurpose;
  context: string;
  identityConcept: string | null;
  seed: number;
};

export type VisualDirectionInput = {
  purpose: VisualPurpose;
  seed: string;
  genres: string[];
  moods: string[];
  instrumental: boolean;
  identityConcept: string | null;
  visualPlan: VisualPlan | null;
};

const SUBJECTS = [
  "a suspended field of translucent signal forms", "an impossible observatory above quiet water",
  "folded structures opening toward a distant horizon", "a weather instrument collecting colored light",
  "a constellation mapped with thread and reflective fragments", "a solitary transmitter inside a paper landscape",
  "layered tidal shapes crossing a geometric threshold", "a miniature city assembled from resonant objects",
  "an abstract garden responding to invisible frequencies", "a luminous path interrupted by floating architecture",
  "a tactile archive of waves, shadows, and hand-cut forms", "a shifting portal built from glass and weathered metal",
  "a kinetic sculpture balancing above a dark shoreline", "a topographic memory rendered as interlocking planes",
  "a quiet machine turning rainfall into narrow beams", "an orbital arrangement of stones, fabric, and light",
];
const MEDIA = [
  "hand-built paper sculpture photographed on medium-format film",
  "risograph print with precise overprint and visible paper tooth",
  "tactile mixed-media collage using cut paper, thread, and translucent acetate",
  "studio macro photography of a practical miniature with subtle film grain",
  "gouache and colored-pencil illustration on uncoated archival paper",
  "cyanotype combined with restrained metallic ink and analog masking",
  "glass and resin assemblage photographed through a handmade optical filter",
  "screen print with imperfect registration and a refined editorial finish",
  "ink wash and graphite drawing with selective opaque color blocking",
  "woven fiber artwork photographed under controlled cinematic light",
  "ceramic relief and cast shadows composed as contemporary graphic design",
  "long-exposure practical light painting over a textured physical set",
];
const COMPOSITIONS = [
  "asymmetric square composition rising from the lower third with deliberate negative space",
  "one unmistakable focal form offset from center with a calm visual counterweight",
  "close crop with layered depth and a narrow path guiding the eye diagonally",
  "radial structure interrupted by one small off-axis detail",
  "low horizon and expansive upper field with a precise editorial balance",
  "overhead still-life arrangement with irregular rhythm and strong silhouette",
  "architectural framing around a small luminous center, readable at thumbnail size",
  "two unequal masses held in tension across a clean square field",
  "foreground texture opening into a distant central passage",
  "stacked planes with one clear visual beat in each depth layer",
  "cropped circular movement crossing a rigid rectangular boundary",
  "quiet central void surrounded by detailed peripheral material",
];
const PALETTES = [
  ["smoked indigo", "oxidized copper", "frosted cyan"],
  ["charcoal black", "warm bone", "signal vermilion"],
  ["deep aubergine", "dusty rose", "pale mineral blue"],
  ["forest ink", "weathered brass", "fog gray"],
  ["midnight blue", "sodium amber", "rain silver"],
  ["burnt umber", "muted apricot", "petrol green"],
  ["graphite", "chalk white", "electric ultramarine"],
  ["dark plum", "aged cream", "acid chartreuse"],
  ["blackened teal", "clay orange", "mist lavender"],
  ["coffee brown", "paper beige", "cold cobalt"],
  ["storm gray", "soft coral", "moss green"],
  ["night violet", "candle gold", "glacial turquoise"],
] as const;
const LIGHTING = [
  "low raking side light revealing every physical edge and fiber",
  "one soft overhead source with a narrow colored reflection",
  "dawn backlight filtered through haze with controlled shadow detail",
  "hard gallery spotlight softened by one bounced fill",
  "subtle bi-color practical lighting with realistic falloff",
  "cloudy-window light interrupted by a precise luminous accent",
  "projected bands of light crossing a mostly matte physical surface",
  "deep evening ambient light with one warm motivated source",
];
const TEXTURES = [
  "visible fibers, restrained halation, fine analog grain, no plastic smoothness",
  "imperfect ink edges, dry paper tooth, and subtle registration shifts",
  "small scratches, translucent overlaps, and physically believable shadows",
  "matte pigments, delicate surface wear, and crisp tactile relief",
  "condensation, soft dust, and controlled lens bloom around highlights",
  "woven detail, embossed marks, and nuanced tonal separation",
  "weathered surfaces, fine rain grain, and careful highlight rolloff",
  "hand-cut edges, adhesive traces, and refined editorial sharpness",
];

function hash(value: string): number {
  let result = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  result ^= result >>> 16;
  result = Math.imul(result, 0x85ebca6b);
  result ^= result >>> 13;
  result = Math.imul(result, 0xc2b2ae35);
  result ^= result >>> 16;
  return result >>> 0;
}

function pick<T>(values: readonly T[], material: string, salt: string): T {
  return values[hash(`${material}:${salt}`) % values.length];
}

function safeText(value: unknown, field: string, max: number, optional = false): string | null {
  if (value == null && optional) return null;
  if (typeof value !== "string" || /[\u0000-\u001f\u007f]/.test(value) || value.length > max) {
    throw new Error(`${field}_invalid`);
  }
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed && !optional) throw new Error(`${field}_invalid`);
  return trimmed || null;
}

function cleanList(values: unknown, field: string, maxItems: number): string[] {
  if (!Array.isArray(values)) throw new Error(`${field}_invalid`);
  return values.slice(0, maxItems).map((value, index) =>
    safeText(value, `${field}_${index}`, 80) as string
  );
}

export function compileVisualDirection(input: VisualDirectionInput): VisualDirection {
  if (
    (input.purpose !== "cover" && input.purpose !== "avatar") ||
    typeof input.seed !== "string" || input.seed.trim().length === 0
  ) {
    throw new Error("visual_direction_input");
  }
  const genres = cleanList(input.genres, "genres", 4);
  const moods = cleanList(input.moods, "moods", 6);
  const identityConcept = safeText(input.identityConcept, "identity_concept", 500, true);
  const context = [genres.join(" / "), moods.join(" / ")].filter(Boolean).join("; ") ||
    "genre-fluid, emotionally focused music";
  const material = `${input.seed}|${input.purpose}|${context}|${input.instrumental}`;
  const plan = input.visualPlan;

  if (plan) {
    return {
      purpose: input.purpose,
      context,
      identityConcept,
      seed: hash(input.seed) & 0x7fffffff,
      concept: safeText(plan.concept, "visual_concept", 500) as string,
      subject: safeText(plan.subject, "visual_subject", 500) as string,
      medium: safeText(plan.medium, "visual_medium", 200) as string,
      composition: safeText(plan.composition, "visual_composition", 300) as string,
      palette: cleanList(plan.palette, "visual_palette", 5),
      lighting: safeText(plan.lighting, "visual_lighting", 300) as string,
      texture: safeText(plan.texture, "visual_texture", 300) as string,
    };
  }

  const subject = input.purpose === "avatar"
    ? "one fictional adult DJ persona with a distinct silhouette, expressive gaze, and original styling"
    : pick(SUBJECTS, material, "subject");
  const identity = identityConcept ??
    (input.purpose === "avatar"
      ? "An original selector translating the musical context into a coherent visual identity."
      : "A physical signal moving from private tension toward a clear emotional release.");

  return {
    purpose: input.purpose,
    context,
    identityConcept,
    seed: hash(input.seed) & 0x7fffffff,
    concept: identity,
    subject,
    medium: pick(MEDIA, material, "medium"),
    composition: pick(COMPOSITIONS, material, "composition"),
    palette: [...pick(PALETTES, material, "palette")],
    lighting: pick(LIGHTING, material, "lighting"),
    texture: pick(TEXTURES, material, "texture"),
  };
}

export function renderVisualPrompt(direction: VisualDirection): string {
  const purpose = direction.purpose === "avatar"
    ? "Square editorial portrait of one fictional adult DJ persona. The subject is an invented character, not a real person; no celebrity likeness."
    : "Square album artwork designed to remain distinctive and legible at thumbnail size. No faces or human portraits.";
  const constraints = direction.purpose === "avatar"
    ? "No text, no typography, no letters, no logo, no watermark, no brand marks, no extra people, no malformed hands, no plastic stock-photo finish."
    : "No text, no typography, no letters, no logo, no watermark, no brand marks, no generic equalizer, no headphones, no vinyl record mockup, no plastic 3D render.";
  const prompt = [
    purpose,
    `MUSICAL CONTEXT: ${direction.context}.`,
    `CONCEPT: ${direction.concept}`,
    `SUBJECT: ${direction.subject}.`,
    `MEDIUM: ${direction.medium}.`,
    `COMPOSITION: ${direction.composition}.`,
    `PALETTE: ${direction.palette.join(", ")}.`,
    `LIGHTING: ${direction.lighting}.`,
    `TEXTURE: ${direction.texture}.`,
    "Make every material physically specific, art-directed, and internally coherent. Preserve one clear focal idea instead of adjective soup.",
    constraints,
  ].join("\n");
  if (prompt.length > 4_000) throw new Error("visual_prompt_too_long");
  return prompt;
}
