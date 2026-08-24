import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCreativeDraftModelInput,
  parseCreativeDraftOutput,
  type AuthoritativeDjTraits,
  type CreativeDraftRequest,
} from "../../supabase/functions/_shared/creative-generation.ts";
import {
  buildImageProviderBody,
  buildTextProviderBody,
} from "../../supabase/functions/_shared/creative-provider-adapters.ts";
import {
  estimateModelCost,
  MODEL_CATALOG,
  resolveCreativeModel,
  type ModelDefinition,
} from "../../supabase/functions/_shared/creative-models.ts";
import {
  replicateMediaPrediction,
  replicateTextPrediction,
  type NormalizedPrediction,
} from "../../supabase/functions/_shared/replicate.ts";
import {
  compileMusicProduction,
  renderLyriaPrompt,
} from "../../supabase/functions/_shared/music-production.ts";
import {
  compileVisualDirection,
  renderVisualPrompt,
} from "../../supabase/functions/_shared/visual-direction.ts";
import {
  compileDjPerformance,
  renderTtsText,
} from "../../supabase/functions/_shared/dj-performance.ts";
import { BenchmarkSpendLedger } from "./creative-benchmark-core.ts";

const LIMIT_USD = 3;
const LIVE = process.argv.includes("--live");
const ONLY = process.argv.find((argument) => argument.startsWith("--only="))
  ?.slice("--only=".length) as TaskKind | undefined;
const token = process.env.REPLICATE_API_TOKEN ?? "";

type TaskKind = "text" | "image" | "music" | "voice";
type PlannedTask = {
  id: string;
  kind: TaskKind;
  model: ModelDefinition;
  locale: "en" | "es";
  variant: string;
  maximumUsd: number;
  run: () => Promise<NormalizedPrediction<string>>;
};

type BenchmarkResult = {
  id: string;
  kind: TaskKind;
  modelId: string;
  locale: "en" | "es";
  variant: string;
  success: boolean;
  reservedUsd: number;
  actualUsd: number;
  latencySeconds: number | null;
  metrics: NormalizedPrediction<string>["metrics"] | null;
  sampleFile: string | null;
  automaticScores?: Record<string, number>;
  error?: string;
};

const textFixtures: Array<{
  id: string;
  locale: "en" | "es";
  request: CreativeDraftRequest;
  context: AuthoritativeDjTraits & { durationSeconds: number };
}> = [
  {
    id: "en-vocal",
    locale: "en",
    request: {
      version: 1,
      kind: "track-brief",
      language: "en",
      djId: "synthetic-en",
      current: {
        creativeDirection:
          "An intimate dream-pop signal begins in a rain-dark apartment and opens into a communal rooftop chorus.",
        lyricTheme: "choosing to be seen after years of hiding",
      },
      exclude: ["Neon Pulse", "Midnight Glow", "Echoes of Tomorrow"],
    },
    context: {
      djName: "Morrow Glass",
      identityConcept: "A patient selector who turns overlooked city sounds into tender widescreen pop.",
      genres: ["Dream Pop", "Alternative Pop"],
      moods: ["intimate", "hopeful", "late night"],
      energy: 6,
      isInstrumental: false,
      vibe: "observant and warm",
      durationSeconds: 120,
    },
  },
  {
    id: "es-vocal",
    locale: "es",
    request: {
      version: 1,
      kind: "track-brief",
      language: "es",
      djId: "synthetic-es",
      current: {
        creativeDirection:
          "Electrónica latina nocturna: una conversación contenida en el último bus se convierte en un coro luminoso al amanecer.",
        lyricTheme: "atreverse a decir lo que quedó pendiente",
      },
      exclude: ["Pulso Lunar", "Bruma Dorada", "Luz de Medianoche"],
    },
    context: {
      djName: "Cauce",
      identityConcept: "Una selectora que encuentra ritmo en trayectos cotidianos y detalles urbanos mínimos.",
      genres: ["Electrónica Latina", "Pop Alternativo"],
      moods: ["íntimo", "cinético", "luminoso"],
      energy: 7,
      isInstrumental: false,
      vibe: "cálida y curiosa",
      durationSeconds: 120,
    },
  },
  {
    id: "en-instrumental",
    locale: "en",
    request: {
      version: 1,
      kind: "track-brief",
      language: "en",
      djId: "synthetic-en-instrumental",
      current: {
        creativeDirection:
          "A dry mechanical pulse inside an empty observatory gradually reveals a weightless three-note signal.",
      },
      exclude: ["Chrome Horizon", "Digital Dreams", "Stellar Drift"],
    },
    context: {
      djName: "Quiet Vector",
      identityConcept: "A restrained architect of negative space, tactile rhythm, and slowly shifting perspective.",
      genres: ["Minimal Techno", "Ambient Electronic"],
      moods: ["focused", "spacious", "quietly tense"],
      energy: 4,
      isInstrumental: true,
      vibe: "precise and contemplative",
      durationSeconds: 120,
    },
  },
  {
    id: "es-instrumental",
    locale: "es",
    request: {
      version: 1,
      kind: "track-brief",
      language: "es",
      djId: "synthetic-es-instrumental",
      current: {
        creativeDirection:
          "Percusión de madera cruza un patio vacío al mediodía y termina convertida en una arquitectura rítmica expansiva.",
      },
      exclude: ["Ritual Solar", "Fuego Ancestral", "Raíz Infinita"],
    },
    context: {
      djName: "Trama Solar",
      identityConcept: "Una constructora rítmica que transforma materiales cotidianos en movimiento colectivo inesperado.",
      genres: ["Folktrónica", "Percusión Latina"],
      moods: ["terrenal", "cinético", "expansivo"],
      energy: 8,
      isInstrumental: true,
      vibe: "audaz y artesanal",
      durationSeconds: 120,
    },
  },
];

const visualFixtures = [
  {
    id: "rain-signal",
    locale: "en" as const,
    genres: ["Dream Pop"],
    moods: ["intimate", "hopeful"],
    instrumental: false,
    visualPlan: {
      concept: "A private signal becomes a shared constellation after rain.",
      subject: "Translucent antenna forms growing above a wet miniature rooftop",
      medium: "Layered paper sculpture photographed on medium-format film",
      composition: "Asymmetric square frame rising from the lower third with open sky",
      palette: ["smoked indigo", "warm amber", "frosted cyan"],
      lighting: "Low amber side light with narrow cyan reflections",
      texture: "Visible paper fibers, fine rain grain, restrained halation",
    },
  },
  {
    id: "bus-dawn",
    locale: "es" as const,
    genres: ["Electrónica Latina"],
    moods: ["cinético", "luminoso"],
    instrumental: false,
    visualPlan: {
      concept: "Una frase pendiente recorre la ciudad hasta transformarse en luz de mañana.",
      subject: "Cintas de papel que cruzan el interior vacío de un autobús en miniatura",
      medium: "Collage táctil de papel, hilo y acetato translúcido",
      composition: "Perspectiva diagonal con un foco cálido al fondo y amplio espacio negativo",
      palette: ["azul petróleo", "naranja arcilla", "amarillo de amanecer"],
      lighting: "Luz azul de madrugada interrumpida por un reflejo cálido",
      texture: "Bordes cortados a mano, vidrio empañado y grano analógico fino",
    },
  },
];

const musicFixtures = [
  {
    id: "en-instrumental",
    locale: "en" as const,
    args: {
      basePrompt: "tactile ambient electronic music",
      seasoning: ["patient morning focus"],
      creativeDirection: "Begin with a three-note glass motif, build quiet polyrhythm, then resolve into open air.",
      instrumental: true,
      durationSeconds: 120,
      language: "en" as const,
      lyrics: null,
      seed: "benchmark-en-instrumental",
      genres: ["Ambient", "Electronic"],
      moods: ["focused", "hopeful"],
      energy: 4,
    },
  },
  {
    id: "es-vocal",
    locale: "es" as const,
    args: {
      basePrompt: "electrónica latina alternativa",
      seasoning: ["amanecer después de la lluvia"],
      creativeDirection: "Verso íntimo sobre percusión seca; el coro abre armonías y responde con mallets de vidrio.",
      instrumental: false,
      durationSeconds: 120,
      language: "es" as const,
      lyrics: "[Verso]\nGuardé la frase en el cristal\nconté las luces al pasar\n\n[Coro]\nDilo conmigo al despertar\nla calle aprende a respirar",
      seed: "benchmark-es-vocal",
      genres: ["Electrónica Latina"],
      moods: ["íntimo", "luminoso"],
      energy: 7,
    },
  },
];

const voiceFixtures = [
  {
    id: "en-calm",
    locale: "en" as const,
    voiceStyle: "androgynous and ethereal",
    moods: ["calm", "late night"],
    character: "Measured and observant",
    caption: "I keep returning to the brushed rhythm hiding just beneath those glassy chords.",
  },
  {
    id: "es-energetic",
    locale: "es" as const,
    voiceStyle: "femenina, brillante y cercana",
    moods: ["energetic", "uplifting"],
    character: "Cálida y curiosa",
    caption: "Yo sigo ese bajo redondo hasta el coro, donde las palmas abren toda la mañana.",
  },
];

const LANGUAGE_MARKERS: Readonly<Record<"en" | "es", ReadonlySet<string>>> = {
  en: new Set([
    "the", "and", "with", "into", "until", "through", "between", "from",
    "without", "over", "inside", "opens", "only", "then",
  ]),
  es: new Set([
    "el", "la", "los", "las", "y", "con", "hasta", "entre", "desde", "sin",
    "por", "dentro", "abre", "que", "una", "un", "de", "del", "al", "solo",
    "entonces",
  ]),
};

export function scoreBenchmarkLocalization(
  text: string,
  locale: "en" | "es",
): number {
  const words = text.toLocaleLowerCase(locale).match(/\p{L}+/gu) ?? [];
  const opposite = locale === "en" ? "es" : "en";
  const targetHits = words.filter((word) => LANGUAGE_MARKERS[locale].has(word)).length;
  const oppositeHits = words.filter((word) => LANGUAGE_MARKERS[opposite].has(word)).length;
  if (targetHits >= 2 && targetHits > oppositeHits) return 1;
  if (oppositeHits >= 2 && oppositeHits > targetHits) return 0.4;
  return 0.6;
}

export function scoreTextBenchmarkSample(
  raw: string,
  fixture: typeof textFixtures[number],
): Record<string, number> {
  try {
    const parsed = parseCreativeDraftOutput("track-brief", raw, {
      language: fixture.locale,
      exclude: fixture.request.exclude,
      djName: fixture.context.djName,
      mode: fixture.context.isInstrumental ? "instrumental" : "vocal",
      durationSeconds: fixture.context.durationSeconds,
    }) as any;
    const plan = parsed.productionPlan;
    const lyrics = String(parsed.lyrics ?? "");
    const lines = lyrics.split("\n").filter((line) => line.trim() && !line.startsWith("["));
    const uniqueLines = new Set(lines.map((line) => line.toLocaleLowerCase())).size;
    const coreMotifs = Array.isArray(plan.novelty?.coreMotifs)
      ? plan.novelty.coreMotifs.map((motif: unknown) => String(motif).trim().toLocaleLowerCase())
      : [];
    const distinctMotifs = new Set(coreMotifs.filter(Boolean)).size;
    const schema = 1;
    const craft = Math.min(1, (
      (Array.isArray(plan.sections) ? plan.sections.length : 0) / 5 +
      (Array.isArray(plan.leadInstruments) ? plan.leadInstruments.length : 0) / 3 +
      (Array.isArray(plan.visual?.palette) ? plan.visual.palette.length : 0) / 3
    ) / 3);
    const genericTitle = /neon pulse|midnight glow|pulso lunar|bruma dorada/i.test(parsed.title);
    const productionOriginality = distinctMotifs >= 2 ? 0.85 : distinctMotifs === 1 ? 0.7 : 0.5;
    const lyricOriginality = Math.min(
      1,
      0.5 + uniqueLines / Math.max(12, lines.length * 2),
    );
    const originality = genericTitle
      ? 0
      : fixture.context.isInstrumental
        ? productionOriginality
        : (productionOriginality + lyricOriginality) / 2;
    const localizedProse = [
      parsed.creativeDirection,
      plan.energyArc,
      ...(Array.isArray(plan.sections)
        ? plan.sections.map((section: { direction?: unknown }) => String(section.direction ?? ""))
        : []),
      lyrics,
    ].join(" ");
    const localization = scoreBenchmarkLocalization(localizedProse, fixture.locale);
    const quality = (schema + craft + originality + localization) / 4;
    return { schema, craft, originality, localization, quality };
  } catch {
    return { schema: 0, craft: 0, originality: 0, localization: 0, quality: 0 };
  }
}

function actualCost(model: ModelDefinition, prediction: NormalizedPrediction<string>, fallback: number): number {
  if (model.price.unit === "tokens") {
    const input = prediction.metrics.inputTokens;
    const output = prediction.metrics.outputTokens;
    if (input != null && output != null) return estimateModelCost(model, { input, output });
  }
  if (model.price.unit === "characters" && prediction.metrics.inputCharacters != null) {
    return estimateModelCost(model, { input: prediction.metrics.inputCharacters, output: 0 });
  }
  return fallback;
}

async function downloadSample(url: string, file: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`sample_download_${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new Error("sample_download_empty");
  await writeFile(file, bytes);
}

function textModels(): ModelDefinition[] {
  return MODEL_CATALOG.filter((model) => model.role === "creative_longform");
}

function imageModels(): ModelDefinition[] {
  return MODEL_CATALOG.filter((model) => model.role === "image_cover");
}

export function planTasks(): PlannedTask[] {
  const tasks: PlannedTask[] = [];
  for (const fixture of textFixtures) {
    const input = buildCreativeDraftModelInput(fixture.request, {
      djContext: fixture.context,
      durationSeconds: fixture.context.durationSeconds,
      recentMemory: {
        titles: fixture.request.exclude,
        visualMotifs: ["generic neon tunnel"],
        hooks: ["wordless oh-oh chorus"],
        productionFingerprints: ["120 BPM | C major | piano house hook"],
      },
    });
    for (const model of textModels()) {
      const maximumUsd = estimateModelCost(model, {
        input: model.limits.input,
        output: input.maxOutputTokens,
      });
      tasks.push({
        id: `text:${fixture.id}:${model.id}`,
        kind: "text",
        model,
        locale: fixture.locale,
        variant: fixture.id,
        maximumUsd,
        run: () => replicateTextPrediction(
          model.endpoint,
          buildTextProviderBody(model, {
            system: `${input.systemPrompt}\nPrompt version: ${input.promptVersion}.`,
            prompt: input.prompt,
            maxOutputTokens: input.maxOutputTokens,
            temperature: input.temperature,
          }),
          { token, pollIntervalMs: 1_500, maxPolls: 80 },
        ),
      });
    }
  }
  for (const fixture of visualFixtures) {
    const direction = compileVisualDirection({
      purpose: "cover",
      seed: `benchmark:${fixture.id}`,
      genres: fixture.genres,
      moods: fixture.moods,
      instrumental: fixture.instrumental,
      identityConcept: null,
      visualPlan: fixture.visualPlan,
    });
    for (const model of imageModels()) {
      const maximumUsd = estimateModelCost(model, { input: 0, output: 1 });
      tasks.push({
        id: `image:${fixture.id}:${model.id}`,
        kind: "image",
        model,
        locale: fixture.locale,
        variant: fixture.id,
        maximumUsd,
        run: () => replicateMediaPrediction(
          model.endpoint,
          buildImageProviderBody(model, {
            prompt: renderVisualPrompt(direction),
            aspectRatio: "1:1",
            outputFormat: "jpg",
            seed: direction.seed,
          }),
          { token, pollIntervalMs: 2_000, maxPolls: 100 },
        ),
      });
    }
  }
  const musicModel = resolveCreativeModel("music_full");
  for (const fixture of musicFixtures) {
    const compiled = compileMusicProduction(fixture.args);
    const prompts = [
      {
        variant: `${fixture.id}:legacy`,
        prompt: [
          fixture.args.basePrompt,
          ...fixture.args.seasoning,
          fixture.args.creativeDirection,
          fixture.args.instrumental ? "instrumental, no vocals" : `sung lyrics:\n${fixture.args.lyrics}`,
          `${fixture.args.durationSeconds} seconds`,
        ].filter(Boolean).join(", ").slice(0, 4_000),
        seed: compiled.seed,
      },
      { variant: `${fixture.id}:structured-v2`, prompt: renderLyriaPrompt(compiled), seed: compiled.seed + 1 },
    ];
    for (const item of prompts) {
      const maximumUsd = estimateModelCost(musicModel, { input: item.prompt.length, output: 1 });
      tasks.push({
        id: `music:${item.variant}:${musicModel.id}`,
        kind: "music",
        model: musicModel,
        locale: fixture.locale,
        variant: item.variant,
        maximumUsd,
        run: () => replicateMediaPrediction(
          musicModel.endpoint,
          { input: { prompt: item.prompt, seed: item.seed & 0x7fffffff } },
          { token, pollIntervalMs: 3_000, maxPolls: 160 },
        ),
      });
    }
  }
  const voiceModel = resolveCreativeModel("voice_caption");
  for (const fixture of voiceFixtures) {
    const profile = compileDjPerformance({
      language: fixture.locale,
      voiceStyle: fixture.voiceStyle,
      moods: fixture.moods,
      character: fixture.character,
    });
    const variants = [
      {
        variant: `${fixture.id}:legacy`,
        text: `[say with a warm, confident radio presence] ${fixture.caption}`,
        rate: 1,
      },
      {
        variant: `${fixture.id}:profile-v2`,
        text: renderTtsText(profile, fixture.caption),
        rate: profile.speakingRate,
      },
    ];
    for (const item of variants) {
      const maximumUsd = estimateModelCost(voiceModel, { input: item.text.length, output: 0 });
      tasks.push({
        id: `voice:${item.variant}:${voiceModel.id}`,
        kind: "voice",
        model: voiceModel,
        locale: fixture.locale,
        variant: item.variant,
        maximumUsd,
        run: () => replicateMediaPrediction(
          voiceModel.endpoint,
          {
            input: {
              text: item.text,
              language: fixture.locale,
              voice_id: profile.voiceId,
              speaking_rate: item.rate,
              audio_format: "mp3",
              sample_rate: 48_000,
              text_normalization: "auto",
            },
          },
          { token, pollIntervalMs: 1_500, maxPolls: 80 },
        ),
      });
    }
  }
  return tasks;
}

async function main() {
  if (ONLY && !(["text", "image", "music", "voice"] as const).includes(ONLY)) {
    throw new Error("benchmark_only_invalid");
  }
  const tasks = planTasks().filter((task) => !ONLY || task.kind === ONLY);
  const ledger = new BenchmarkSpendLedger(LIMIT_USD);
  for (const task of tasks) ledger.reserve(task.id, task.maximumUsd);
  const preflight = {
    mode: LIVE ? "live" : "dry-run",
    taskCount: tasks.length,
    byKind: Object.fromEntries(
      (["text", "image", "music", "voice"] as const).map((kind) => [
        kind,
        tasks.filter((task) => task.kind === kind).length,
      ]),
    ),
    spend: ledger.summary(),
  };
  console.log(JSON.stringify(preflight, null, 2));
  if (!LIVE) return;
  if (!token) throw new Error("REPLICATE_API_TOKEN missing");

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const root = path.resolve(`.creative-benchmark/${stamp}`);
  const blindDir = path.join(root, "blind");
  await mkdir(blindDir, { recursive: true });
  const results: BenchmarkResult[] = [];
  const blindMap: Record<string, { taskId: string; modelId: string; variant: string }> = {};
  let sampleIndex = 0;

  for (const task of tasks) {
    sampleIndex += 1;
    const sampleId = `sample-${String(sampleIndex).padStart(3, "0")}`;
    const extension = task.kind === "text" ? "txt" : task.kind === "image" ? "jpg" : "mp3";
    const relativeFile = `blind/${sampleId}.${extension}`;
    const targetFile = path.join(root, relativeFile);
    process.stdout.write(`[${sampleIndex}/${tasks.length}] ${task.kind} ${task.variant} ... `);
    try {
      const prediction = await task.run();
      const cost = actualCost(task.model, prediction, task.maximumUsd);
      ledger.complete(task.id, Math.min(task.maximumUsd, cost));
      if (task.kind === "text") {
        await writeFile(targetFile, prediction.output, "utf8");
      } else {
        await downloadSample(prediction.output, targetFile);
      }
      const fixture = task.kind === "text"
        ? textFixtures.find(({ id }) => id === task.variant)
        : null;
      results.push({
        id: task.id,
        kind: task.kind,
        modelId: task.model.id,
        locale: task.locale,
        variant: task.variant,
        success: true,
        reservedUsd: task.maximumUsd,
        actualUsd: Math.min(task.maximumUsd, cost),
        latencySeconds: prediction.metrics.predictSeconds,
        metrics: prediction.metrics,
        sampleFile: relativeFile,
        ...(fixture
          ? { automaticScores: scoreTextBenchmarkSample(prediction.output, fixture) }
          : {}),
      });
      blindMap[sampleId] = { taskId: task.id, modelId: task.model.id, variant: task.variant };
      console.log("ok");
    } catch (error) {
      ledger.complete(task.id, task.maximumUsd);
      results.push({
        id: task.id,
        kind: task.kind,
        modelId: task.model.id,
        locale: task.locale,
        variant: task.variant,
        success: false,
        reservedUsd: task.maximumUsd,
        actualUsd: task.maximumUsd,
        latencySeconds: null,
        metrics: null,
        sampleFile: null,
        error: error instanceof Error ? error.message.slice(0, 200) : "benchmark_task_failed",
      });
      console.log("failed");
    }
  }

  const report = {
    version: 1,
    createdAt: new Date().toISOString(),
    syntheticOnly: true,
    storage: "local-only; no database or R2 writes",
    spend: ledger.summary(),
    results,
  };
  await writeFile(path.join(root, "report.json"), JSON.stringify(report, null, 2), "utf8");
  await writeFile(path.join(root, "blind-map.json"), JSON.stringify(blindMap, null, 2), "utf8");
  console.log(JSON.stringify({ artifactRoot: root, spend: ledger.summary() }, null, 2));
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "creative benchmark failed");
    process.exitCode = 1;
  });
}
