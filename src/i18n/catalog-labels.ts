import type { SupportedLanguage } from "./types";
import type { DJMood, Genre } from "@/src/types/music-preferences";

type CatalogValue = Genre | DJMood;
type CatalogGroup =
  | "Chill & Ambient"
  | "Electronic"
  | "Classical & Cinematic"
  | "Jazz & Soul"
  | "Latin"
  | "Indie & Folk"
  | "Global"
  | "Calm"
  | "Bright"
  | "Deep";

const EN_CATALOG_LABELS: Readonly<Record<CatalogValue, string>> = Object.freeze({
  Ambient: "Ambient",
  Drone: "Drone",
  "Lo-Fi": "Lo-Fi",
  Chillhop: "Chillhop",
  Downtempo: "Downtempo",
  "Trip-Hop": "Trip-Hop",
  IDM: "IDM",
  "Minimal Techno": "Minimal Techno",
  Techno: "Techno",
  House: "House",
  "Deep House": "Deep House",
  Trance: "Trance",
  Synthwave: "Synthwave",
  "Drum & Bass": "Drum & Bass",
  Dub: "Dub",
  "Neo-Classical": "Neo-Classical",
  Classical: "Classical",
  Piano: "Piano",
  Cinematic: "Cinematic",
  Jazz: "Jazz",
  Blues: "Blues",
  Soul: "Soul",
  Funk: "Funk",
  "R&B": "R&B",
  "Bossa Nova": "Bossa Nova",
  Reggaeton: "Reggaeton",
  Salsa: "Salsa",
  Cumbia: "Cumbia",
  Bachata: "Bachata",
  Merengue: "Merengue",
  "Latin Pop": "Latin Pop",
  "Latin Jazz": "Latin Jazz",
  "Post-Rock": "Post-Rock",
  Indie: "Indie",
  "Dream Pop": "Dream Pop",
  Folk: "Folk",
  Acoustic: "Acoustic",
  Afrobeat: "Afrobeat",
  World: "World",
  Focus: "Focus",
  Relax: "Relax",
  Dreamy: "Dreamy",
  Meditate: "Meditate",
  Nature: "Nature",
  Sleep: "Sleep",
  Cozy: "Cozy",
  Ethereal: "Ethereal",
  Energetic: "Energetic",
  Uplifting: "Uplifting",
  Happy: "Happy",
  Euphoric: "Euphoric",
  Playful: "Playful",
  Groovy: "Groovy",
  Party: "Party",
  Workout: "Workout",
  Dark: "Dark",
  Melancholic: "Melancholic",
  Romantic: "Romantic",
  Nostalgic: "Nostalgic",
  Mysterious: "Mysterious",
  Epic: "Epic",
  Intense: "Intense",
  "Late Night": "Late Night",
  "Rainy Day": "Rainy Day",
});

const ES_CATALOG_LABELS: Readonly<Record<CatalogValue, string>> = Object.freeze({
  Ambient: "Ambiental",
  Drone: "Drone",
  "Lo-Fi": "Lo-fi",
  Chillhop: "Chillhop",
  Downtempo: "Downtempo",
  "Trip-Hop": "Trip-hop",
  IDM: "IDM",
  "Minimal Techno": "Techno minimal",
  Techno: "Techno",
  House: "House",
  "Deep House": "House profundo",
  Trance: "Trance",
  Synthwave: "Synthwave",
  "Drum & Bass": "Drum and bass",
  Dub: "Dub",
  "Neo-Classical": "Neoclásica",
  Classical: "Clásica",
  Piano: "Piano",
  Cinematic: "Cinemática",
  Jazz: "Jazz",
  Blues: "Blues",
  Soul: "Soul",
  Funk: "Funk",
  "R&B": "R&B",
  "Bossa Nova": "Bossa nova",
  Reggaeton: "Reguetón",
  Salsa: "Salsa",
  Cumbia: "Cumbia",
  Bachata: "Bachata",
  Merengue: "Merengue",
  "Latin Pop": "Pop latino",
  "Latin Jazz": "Jazz latino",
  "Post-Rock": "Post-rock",
  Indie: "Indie",
  "Dream Pop": "Dream pop",
  Folk: "Folk",
  Acoustic: "Acústica",
  Afrobeat: "Afrobeat",
  World: "Músicas del mundo",
  Focus: "Concentración",
  Relax: "Relajación",
  Dreamy: "Soñador",
  Meditate: "Meditación",
  Nature: "Naturaleza",
  Sleep: "Sueño",
  Cozy: "Acogedor",
  Ethereal: "Etéreo",
  Energetic: "Enérgico",
  Uplifting: "Inspirador",
  Happy: "Alegre",
  Euphoric: "Eufórico",
  Playful: "Juguetón",
  Groovy: "Con ritmo",
  Party: "Fiesta",
  Workout: "Entrenamiento",
  Dark: "Oscuro",
  Melancholic: "Melancólico",
  Romantic: "Romántico",
  Nostalgic: "Nostálgico",
  Mysterious: "Misterioso",
  Epic: "Épico",
  Intense: "Intenso",
  "Late Night": "Noche",
  "Rainy Day": "Día lluvioso",
});

const EN_GROUP_LABELS: Readonly<Record<CatalogGroup, string>> = Object.freeze({
  "Chill & Ambient": "Chill & Ambient",
  Electronic: "Electronic",
  "Classical & Cinematic": "Classical & Cinematic",
  "Jazz & Soul": "Jazz & Soul",
  Latin: "Latin",
  "Indie & Folk": "Indie & Folk",
  Global: "Global",
  Calm: "Calm",
  Bright: "Bright",
  Deep: "Deep",
});

const ES_GROUP_LABELS: Readonly<Record<CatalogGroup, string>> = Object.freeze({
  "Chill & Ambient": "Relajado y ambiental",
  Electronic: "Electrónica",
  "Classical & Cinematic": "Clásica y cinematográfica",
  "Jazz & Soul": "Jazz y soul",
  Latin: "Latina",
  "Indie & Folk": "Indie y folk",
  Global: "Global",
  Calm: "Calma",
  Bright: "Vibrante",
  Deep: "Profundo",
});

const CATALOG_LABELS: Readonly<
  Record<SupportedLanguage, Readonly<Record<CatalogValue, string>>>
> = Object.freeze({ en: EN_CATALOG_LABELS, es: ES_CATALOG_LABELS });

const GROUP_LABELS: Readonly<
  Record<SupportedLanguage, Readonly<Record<CatalogGroup, string>>>
> = Object.freeze({ en: EN_GROUP_LABELS, es: ES_GROUP_LABELS });

export function catalogLabel(value: string, language: SupportedLanguage): string {
  return (CATALOG_LABELS[language] as Readonly<Record<string, string>>)[value] ?? value;
}

export function catalogGroupLabel(
  value: string,
  language: SupportedLanguage,
): string {
  return (GROUP_LABELS[language] as Readonly<Record<string, string>>)[value] ?? value;
}
