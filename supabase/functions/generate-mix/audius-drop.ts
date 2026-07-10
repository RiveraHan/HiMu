import {
  AudiusTrack,
  fetchTrending,
  mapDjGenre,
  parsePickResponse,
} from "../_shared/audius.ts";
import { replicateText } from "../_shared/replicate.ts";

// Same Llama endpoint the caption uses; the pick is a separate call site.
const LLAMA_ENDPOINT =
  "https://api.replicate.com/v1/models/meta/meta-llama-3-8b-instruct/predictions";

const CANDIDATE_LIMIT = 12;

function normalizeHour(localHour: unknown): number {
  return typeof localHour === "number" &&
    Number.isInteger(localHour) &&
    localHour >= 0 &&
    localHour <= 23
    ? localHour
    : new Date().getUTCHours();
}

function timePhrase(hour: number): string {
  if (hour >= 5 && hour <= 11) return "this morning";
  if (hour >= 12 && hour <= 17) return "this afternoon";
  if (hour >= 18 && hour <= 22) return "tonight";
  return "in the late hours";
}

export type AudiusPick = { pick: AudiusTrack; caption: string };

// The DJ picks ONE real Audius track from trending in their genre and introduces
// it. Returns null when no playable candidate exists (caller falls back to
// generation). Never throws for an empty shortlist; a failed LLM call degrades
// to the parse fallback (candidate 0 + templated caption).
export async function pickAudiusDrop(
  dj: any,
  localHour: unknown,
): Promise<AudiusPick | null> {
  const genre = mapDjGenre(dj?.genre_specialties);
  const candidates = await fetchTrending(genre, CANDIDATE_LIMIT);
  if (candidates.length === 0) return null;

  const hour = normalizeHour(localHour);
  const name = String(dj?.name ?? "Your DJ");
  const character = String(dj?.character ?? "").slice(0, 300);
  const voice = String(dj?.voice_style ?? "").slice(0, 120);

  const shortlist = candidates
    .map(
      (c, i) =>
        `${i + 1}. ${c.title} — ${c.user?.name ?? "Unknown"}` +
        (c.genre ? ` [${c.genre}${c.mood ? `, ${c.mood}` : ""}]` : ""),
    )
    .join("\n");

  const system =
    `You are ${name}, an AI radio DJ with impeccable taste. Persona: ${character}. Voice: ${voice}. ` +
    `You are curating today's drop by picking ONE real track from a shortlist. ` +
    `Choose the one that best fits your vibe and the moment, then introduce it in ONE short ` +
    `first-person line (max 20 words) that names the artist. Plain text only, English.`;
  const prompt =
    `Genre: ${genre ?? "eclectic"}. Time of day: ${timePhrase(hour)}.\n` +
    `Shortlist:\n${shortlist}\n\n` +
    `Respond in exactly this format:\nPICK: <number>\nCAPTION: <your one line>`;

  let raw = "";
  try {
    raw = await replicateText(LLAMA_ENDPOINT, {
      input: { system_prompt: system, prompt, max_tokens: 80, temperature: 0.8 },
    });
  } catch (_e) {
    raw = ""; // fall through to the parse fallback
  }

  const { index, caption } = parsePickResponse(raw, candidates.length);
  const pick = candidates[index] ?? candidates[0];
  const finalCaption =
    caption ??
    `Fresh find — ${pick.title} by ${pick.user?.name ?? "an artist I love"}.`;

  return { pick, caption: finalCaption };
}
