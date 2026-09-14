export type PerformanceLanguage = "en" | "es";
export type InworldVoice = "Ashley" | "Dennis" | "Alex" | "Darlene";

export type DjPerformanceProfile = {
  language: PerformanceLanguage;
  voiceId: InworldVoice;
  speakingRate: number;
  deliveryCue: string;
  captionMove: string;
  energy: "calm" | "balanced" | "energetic";
};

export type DjPerformanceInput = {
  language: PerformanceLanguage;
  voiceStyle: unknown;
  moods: unknown;
  character: unknown;
};

const HIGH = new Set([
  "energetic", "uplifting", "euphoric", "happy", "dance", "party", "workout",
  "fiery", "bold", "kinetic", "bright", "intense",
]);
const CALM = new Set([
  "calm", "chill", "relaxed", "focus", "meditate", "nature", "sleep", "cozy",
  "ethereal", "melancholic", "nostalgic", "late night", "rainy day", "intimate",
]);
const MOVES = {
  en: {
    calm: [
      "point to one quiet production detail", "connect the track to the present hour",
      "name one texture the listener can follow", "frame the song as a small discovery",
    ],
    balanced: [
      "name one concrete sonic detail", "make one concise emotional observation",
      "invite attention to a specific musical turn", "connect one texture to the DJ's point of view",
    ],
    energetic: [
      "spotlight one rhythmic detail", "name the exact moment where the track opens up",
      "invite movement through one concrete musical cue", "point to the hook without hype language",
    ],
  },
  es: {
    calm: [
      "señala un detalle sereno de la producción", "conecta la canción con este momento del día",
      "nombra una textura que se pueda seguir", "presenta la canción como un hallazgo íntimo",
    ],
    balanced: [
      "nombra un detalle sonoro concreto", "haz una observación emocional breve",
      "dirige la atención hacia un giro musical específico", "conecta una textura con tu punto de vista",
    ],
    energetic: [
      "destaca un detalle rítmico", "nombra el momento exacto en que la canción se abre",
      "invita a moverse con una señal musical concreta", "señala el gancho sin usar lenguaje exagerado",
    ],
  },
} as const;

function clean(value: unknown, max: number): string {
  return typeof value === "string"
    ? value.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max)
    : "";
}

function hash(value: string): number {
  let result = 2_166_136_261;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 16_777_619);
  }
  result ^= result >>> 16;
  result = Math.imul(result, 0x85ebca6b);
  result ^= result >>> 13;
  return result >>> 0;
}

function voiceFor(styleValue: string): InworldVoice {
  const style = styleValue.toLocaleLowerCase();
  if (/androg|andróg|ethereal|etérea|etéreo/.test(style)) return "Alex";
  if (/mascul|baritone|barítono/.test(style)) return "Dennis";
  if (/sultry|smoky|grave|aterciopelad|warm/.test(style) && !/femeni/.test(style)) {
    return "Darlene";
  }
  return "Ashley";
}

export function compileDjPerformance(input: DjPerformanceInput): DjPerformanceProfile {
  if (input.language !== "en" && input.language !== "es") {
    throw new Error("dj_performance_language");
  }
  const style = clean(input.voiceStyle, 120);
  const character = clean(input.character, 300);
  const moods = Array.isArray(input.moods)
    ? input.moods.map((mood) => clean(mood, 80)).filter(Boolean).slice(0, 8)
    : [];
  let score = 0;
  for (const mood of moods) {
    const normalized = mood.toLocaleLowerCase();
    if (HIGH.has(normalized)) score += 1;
    if (CALM.has(normalized)) score -= 1;
  }
  const energy = score > 0 ? "energetic" : score < 0 ? "calm" : "balanced";
  const deliveryCue = input.language === "es"
    ? energy === "energetic"
      ? "di con energía luminosa y una sonrisa audible"
      : energy === "calm"
        ? "di de cerca, con calma y ritmo medido"
        : "di con calidez, seguridad y ritmo natural"
    : energy === "energetic"
      ? "say with bright energy and an audible smile"
      : energy === "calm"
        ? "say close and calm with measured pacing"
        : "say with warm confidence and natural pacing";
  const moves = MOVES[input.language][energy];
  const material = `${style}|${character}|${moods.join("|")}|${input.language}`;
  return {
    language: input.language,
    voiceId: voiceFor(style),
    speakingRate: energy === "energetic" ? 1.08 : energy === "calm" ? 0.94 : 1,
    deliveryCue,
    captionMove: moves[hash(material) % moves.length],
    energy,
  };
}

export function renderCaptionSystemPrompt(input: {
  djName: string;
  character: string;
  profile: DjPerformanceProfile;
  kind: "generated_track" | "curated_track";
}): string {
  const name = clean(input.djName, 120) || (input.profile.language === "es" ? "Tu DJ" : "Your DJ");
  const character = clean(input.character, 300) ||
    (input.profile.language === "es" ? "observador y musical" : "observant and musical");
  if (input.profile.language === "es") {
    return [
      `Eres ${name}, DJ de radio. Personalidad: ${character}.`,
      input.kind === "curated_track"
        ? "Presenta una canción real que acabas de seleccionar."
        : "Presenta la nueva canción que acabas de crear.",
      `Escribe una sola línea en primera persona, de 8 a 20 palabras, en español latinoamericano neutro; ${input.profile.captionMove}.`,
      "Incluye un detalle de escucha concreto. No inventes hechos sobre el artista o la canción.",
      "Sin emojis, hashtags, comillas, órdenes escénicas, saludos ni preámbulo.",
      "Evita frases gastadas como «sube el volumen», «déjate llevar», «vibra conmigo» o «esta joya».",
      "Devuelve únicamente la línea entre estos marcadores:",
      "[CAPTION_START]\ntu línea\n[CAPTION_END]",
    ].join(" ");
  }
  return [
    `You are ${name}, a radio DJ. Persona: ${character}.`,
    input.kind === "curated_track"
      ? "Introduce one real track you just selected."
      : "Introduce the new track you just created.",
    `Write one first-person line of 8 to 20 words; ${input.profile.captionMove}.`,
    "Include one concrete listening detail. Never invent facts about the artist or track.",
    "No emojis, hashtags, quotation marks, stage directions, greeting, or preamble.",
    "Avoid tired phrases such as turn it up, lose yourself, vibe with me, or hidden gem.",
    "Return only the line between these markers:",
    "[CAPTION_START]\nyour line\n[CAPTION_END]",
  ].join(" ");
}

export function renderTtsText(profile: DjPerformanceProfile, caption: string): string {
  if (
    typeof caption !== "string" || caption.length > 140 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(caption)
  ) {
    throw new Error("caption_invalid");
  }
  const safeCaption = caption.trim().replaceAll("[", "(").replaceAll("]", ")");
  if (!safeCaption) throw new Error("caption_invalid");
  const text = `[${profile.deliveryCue}] ${safeCaption}`;
  if (text.length > 200) throw new Error("caption_tts_budget");
  return text;
}
