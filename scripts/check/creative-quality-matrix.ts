import assert from "node:assert/strict";

import {
  buildCreativeDraftModelInput,
  parseCreativeDraftOutput,
  type AuthoritativeDjTraits,
  type CreativeDraftRequest,
  type CreativeLanguage,
} from "../../supabase/functions/_shared/creative-generation.ts";

type Scenario = {
  label: string;
  language: CreativeLanguage;
  context: AuthoritativeDjTraits;
  identities: [string, string, string];
  title: string;
  regeneratedTitle: string;
  direction: string;
  regeneratedDirection: string;
  lyricTheme: string | null;
  lyrics: string | null;
  regeneratedLyrics: string | null;
};

const scenarios: Scenario[] = [
  {
    label: "calm instrumental EN",
    language: "en",
    context: { djName: "Still Meridian", identityConcept: "A quiet cartographer of patient sound.", genres: ["Ambient"], moods: ["Focus"], energy: 2, isInstrumental: true, vibe: "dawn mist over an empty library" },
    identities: ["Moss Atlas", "Quiet Loom", "Dawn Cartographer"],
    title: "Rain on Porcelain",
    regeneratedTitle: "Rooms Between Breaths",
    direction: "Let soft drones and sparse piano open gradually, preserving generous silence between phrases.",
    regeneratedDirection: "Shape a restrained arc from field-recording hush toward a warm, weightless final chord.",
    lyricTheme: null,
    lyrics: null,
    regeneratedLyrics: null,
  },
  {
    label: "intense instrumental ES",
    language: "es",
    context: { djName: "Filo Sísmico", identityConcept: "Una fuerza nocturna que esculpe tensión rítmica.", genres: ["Techno"], moods: ["Intense"], energy: 10, isInstrumental: true, vibe: "túnel industrial bajo luces rojas" },
    identities: ["Pulso Sísmico", "Filo Vector", "Motor Umbral"],
    title: "Acero Bajo la Tormenta",
    regeneratedTitle: "Cúpula de Mercurio",
    direction: "Construye una presión percusiva implacable con cortes secos, bajos tensos y un clímax mecánico.",
    regeneratedDirection: "Abre con pulsos contenidos y libera capas metálicas hasta cerrar en un golpe abrupto.",
    lyricTheme: null,
    lyrics: null,
    regeneratedLyrics: null,
  },
  {
    label: "calm vocal ES",
    language: "es",
    context: { djName: "Carta de Agua", identityConcept: "Una narradora íntima de recuerdos luminosos.", genres: ["Dream Pop"], moods: ["Dreamy"], energy: 3, isInstrumental: false, vibe: "ventana lluviosa al amanecer" },
    identities: ["Nube Epistolar", "Clara Marea", "Jardín de Vidrio"],
    title: "Cartas Bajo el Agua",
    regeneratedTitle: "La Casa que Respira",
    direction: "Sostén una voz cercana sobre guitarras difusas y deja que el coro florezca sin romper la calma.",
    regeneratedDirection: "Empieza como una confesión mínima y ensancha las armonías apenas al llegar al coro.",
    lyricTheme: "aprender a soltar un recuerdo querido",
    lyrics: "[Verso]\nGuardo tu luz en una taza azul\nLa lluvia aprende a decir adiós\n[Coro]\nDejo la puerta respirar\nY el agua me devuelve al mar",
    regeneratedLyrics: "[Verso]\nDoblo la tarde dentro del papel\nTu nombre cruza lento el ventanal\n[Coro]\nLa casa vuelve a respirar\nCuando decido caminar",
  },
  {
    label: "intense vocal EN",
    language: "en",
    context: { djName: "Rooftop Ember", identityConcept: "A fearless midnight voice turning pressure into release.", genres: ["Drum & Bass"], moods: ["Euphoric"], energy: 9, isInstrumental: false, vibe: "a storm breaking above neon rooftops" },
    identities: ["Voltage Oracle", "Ember Relay", "Storm Syntax"],
    title: "Sirens in the Rafters",
    regeneratedTitle: "Fire Escape Constellation",
    direction: "Drive clipped drums beneath a defiant vocal, then open the chorus into a bright communal release.",
    regeneratedDirection: "Tighten the verses around restless bass before the hook bursts into stacked voices and air.",
    lyricTheme: "choosing courage while the city closes in",
    lyrics: "[Verse]\nThe stairwell shakes beneath our feet\nWe name the fear and keep the beat\n[Chorus]\nRaise every window to the rain\nWe turn the pressure into flame",
    regeneratedLyrics: "[Verse]\nRed signals flicker through the smoke\nI find my voice in every note\n[Chorus]\nWe draw a map across the night\nAnd make the fire escape ignite",
  },
];

const allIdentityNames = new Set<string>();
for (const scenario of scenarios) {
  const request: CreativeDraftRequest = {
    version: 1,
    kind: "track-brief",
    language: scenario.language,
    djId: `matrix-${scenario.label}`,
    current: {},
    exclude: [],
  };
  const modelInput = buildCreativeDraftModelInput(request, { djContext: scenario.context });
  assert.match(modelInput.systemPrompt, new RegExp(`locale ${scenario.language}`));
  assert.match(modelInput.prompt, new RegExp(`"energy":${scenario.context.energy}`));
  assert.match(modelInput.prompt, new RegExp(`"mode":"${scenario.context.isInstrumental ? "instrumental" : "vocal"}"`));

  const identities = parseCreativeDraftOutput("dj-identity", JSON.stringify({
    candidates: scenario.identities.map((name, index) => ({
      name,
      identityConcept: `${scenario.context.identityConcept} Distinct concept ${index + 1}.`,
    })),
  }), { language: scenario.language, exclude: [] }).candidates!;
  assert.equal(new Set(identities.map(({ name }) => name)).size, 3, `${scenario.label}: identity diversity`);
  identities.forEach(({ name }) => {
    assert.equal(allIdentityNames.has(name), false, `${scenario.label}: identity reused`);
    allIdentityNames.add(name);
  });

  const brief = parseCreativeDraftOutput("track-brief", JSON.stringify({
    title: scenario.title,
    creativeDirection: scenario.direction,
    lyricTheme: scenario.lyricTheme,
    lyrics: scenario.lyrics,
  }), {
    language: scenario.language,
    exclude: [],
    djName: scenario.context.djName,
    mode: scenario.context.isInstrumental ? "instrumental" : "vocal",
  });
  assert.equal(brief.title, scenario.title, `${scenario.label}: non-generic title`);

  const title = parseCreativeDraftOutput("track-title", JSON.stringify({ title: scenario.regeneratedTitle }), {
    language: scenario.language,
    exclude: [scenario.title],
    djName: scenario.context.djName,
  });
  assert.equal(title.title, scenario.regeneratedTitle, `${scenario.label}: granular title regeneration`);
  const direction = parseCreativeDraftOutput("creative-direction", JSON.stringify({ creativeDirection: scenario.regeneratedDirection }), {
    language: scenario.language,
    exclude: [scenario.direction],
  });
  assert.equal(direction.creativeDirection, scenario.regeneratedDirection, `${scenario.label}: granular direction regeneration`);

  if (scenario.context.isInstrumental) {
    assert.equal(brief.lyrics, null, `${scenario.label}: instrumental lyrics`);
  } else {
    const lyrics = parseCreativeDraftOutput("lyrics", JSON.stringify({
      lyricTheme: scenario.lyricTheme,
      lyrics: scenario.regeneratedLyrics,
    }), { language: scenario.language, exclude: [scenario.lyrics!] });
    assert.equal(lyrics.lyrics, scenario.regeneratedLyrics, `${scenario.label}: complete localized lyric regeneration`);
  }
}

assert.equal(allIdentityNames.size, scenarios.length * 3);
console.log(`creative quality matrix passed (${scenarios.length} EN/ES trait profiles, ${allIdentityNames.size} distinct identities)`);
