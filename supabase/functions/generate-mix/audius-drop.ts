import {
  AudiusTrack,
  fetchTrending,
  mapDjGenre,
  parsePickResponse,
} from "../_shared/audius.ts";
import {
  captionTimePhrase,
  fallbackAudiusCaption,
  GenerationLanguage,
  LLAMA_ENDPOINT,
} from "./generation-models.ts";

const CANDIDATE_LIMIT = 12;

export type AudiusPick = { pick: AudiusTrack; caption: string };

export function fallbackAudiusPickCaption(
  language: GenerationLanguage = "en",
  trackTitle: string,
  artistName?: string | null,
): string {
  return fallbackAudiusCaption(language, trackTitle, artistName);
}

export function buildAudiusPickInput(
  dj: any,
  localHour: unknown,
  candidates: AudiusTrack[],
  language: GenerationLanguage,
): {
  endpoint: string;
  body: { input: {
    system_prompt: string;
    prompt: string;
    max_tokens: 80;
    temperature: 0.8;
  } };
} {
  const genre = mapDjGenre(dj?.genre_specialties);
  const name = String(dj?.name ?? (language === "es" ? "Tu DJ" : "Your DJ"));
  const character = String(dj?.character ?? "").slice(0, 300);
  const voice = String(dj?.voice_style ?? "").slice(0, 120);
  const shortlist = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.title} — ${c.user?.name ?? "Unknown"}` +
        (c.genre ? ` [${c.genre}${c.mood ? `, ${c.mood}` : ""}]` : ""),
    )
    .join("\n");
  const systemPrompt = language === "es"
    ? `Eres ${name}, DJ de radio con gran criterio. Personalidad: ${character}. Voz: ${voice}. ` +
      "Estás seleccionando el lanzamiento de hoy: elige UNA canción real de la lista. " +
      "Escoge la que mejor encaje con tu vibra y el momento, y preséntala en UNA línea breve " +
      "en primera persona (máximo 20 palabras) que nombre al artista. " +
      "Escribe en español latinoamericano neutro. Solo texto plano."
    : `You are ${name}, an AI radio DJ with impeccable taste. Persona: ${character}. Voice: ${voice}. ` +
      "You are curating today's drop by picking ONE real track from a shortlist. " +
      "Choose the one that best fits your vibe and the moment, then introduce it in ONE short " +
      "first-person line (max 20 words) that names the artist. Plain text only, English.";
  const prompt = language === "es"
    ? `Género: ${genre ?? "ecléctico"}. Momento del día: ${captionTimePhrase(localHour, language)}.\n` +
      `Lista corta:\n${shortlist}\n\n` +
      "Responde exactamente con este formato:\nPICK: <number>\nCAPTION: <tu línea>"
    : `Genre: ${genre ?? "eclectic"}. Time of day: ${captionTimePhrase(localHour, language)}.\n` +
      `Shortlist:\n${shortlist}\n\n` +
      "Respond in exactly this format:\nPICK: <number>\nCAPTION: <your one line>";

  return {
    endpoint: LLAMA_ENDPOINT,
    body: {
      input: { system_prompt: systemPrompt, prompt, max_tokens: 80, temperature: 0.8 },
    },
  };
}

// The DJ picks ONE real Audius track from trending in their genre and introduces
// it. Returns null when no playable candidate exists (caller falls back to
// generation). Never throws for an empty shortlist; a failed LLM call degrades
// to the parse fallback (candidate 0 + templated caption).
export async function pickAudiusDrop(
  dj: any,
  localHour: unknown,
  language: GenerationLanguage = "en",
): Promise<AudiusPick | null> {
  const genre = mapDjGenre(dj?.genre_specialties);
  const candidates = await fetchTrending(genre, CANDIDATE_LIMIT);
  if (candidates.length === 0) return null;
  const input = buildAudiusPickInput(dj, localHour, candidates, language);

  let raw = "";
  try {
    const { replicateText } = await import("../_shared/replicate.ts");
    raw = await replicateText(input.endpoint, input.body);
  } catch (_e) {
    raw = ""; // fall through to the parse fallback
  }

  const { index, caption } = parsePickResponse(raw, candidates.length);
  const pick = candidates[index] ?? candidates[0];
  const finalCaption =
    caption ??
    fallbackAudiusPickCaption(language, pick.title, pick.user?.name);

  return { pick, caption: finalCaption };
}
