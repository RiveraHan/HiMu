import { GENRE_GROUPS, MOOD_GROUPS } from "@/src/types/music-preferences";
import { catalogGroupLabel, catalogLabel } from "../catalog-labels";

const spanishGroups = {
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
} as const;

const spanishItems = {
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
} as const;

test("maps every canonical catalog group in both languages", () => {
  const groups = [...GENRE_GROUPS, ...MOOD_GROUPS].map((group) => group.label);

  expect(Object.keys(spanishGroups)).toEqual(groups);
  for (const group of groups) {
    expect(catalogGroupLabel(group, "en")).toBe(group);
    expect(catalogGroupLabel(group, "es")).toBe(
      spanishGroups[group as keyof typeof spanishGroups],
    );
  }
});

test("maps every canonical catalog item in both languages", () => {
  const items = [...GENRE_GROUPS, ...MOOD_GROUPS].flatMap(
    (group) => group.items,
  );

  expect(Object.keys(spanishItems)).toEqual(items);
  for (const item of items) {
    expect(catalogLabel(item, "en")).toBe(item);
    expect(catalogLabel(item, "es")).toBe(
      spanishItems[item as keyof typeof spanishItems],
    );
  }
});

test("leaves values outside the canonical catalog unchanged", () => {
  expect(catalogLabel("Unknown Style", "es")).toBe("Unknown Style");
  expect(catalogGroupLabel("Unknown Group", "es")).toBe("Unknown Group");
});
