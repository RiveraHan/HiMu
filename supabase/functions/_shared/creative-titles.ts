export type CreativeTitleInput = {
  language: "en" | "es";
  seed: string;
  genres: string[];
  moods: string[];
  recentTitles: string[];
};

type TitleLexicon = {
  heads: readonly string[];
  images: readonly string[];
  motions: readonly string[];
  states: readonly string[];
  templates: readonly ((head: string, image: string, motion: string, state: string) => string)[];
};

const ENGLISH: TitleLexicon = {
  heads: [
    "Borrowed Weather", "Paper Satellites", "Quiet Machinery", "Second Sunrise",
    "Silver Static", "Open Water", "Soft Geometry", "Distant Rooms",
    "Weightless Signals", "Wild Frequency", "Slow Fire", "Glass Gardens",
    "Unwritten Maps", "Folding Light", "Parallel Skies", "Tender Voltage",
    "Secret Architecture", "Small Revolutions", "Weathered Gold", "Invisible Thread",
    "Low Orbit", "Blue Distance", "Magnetic Sleep", "Hollow Constellations",
  ],
  images: [
    "Blue Glass", "the Last Platform", "Rainlit Windows", "a Sleeping City",
    "the Northern Signal", "Paper Moons", "the Long Way Home", "Unsent Letters",
    "a Copper Horizon", "the Empty Cinema", "Clouded Mirrors", "the Rooftop Garden",
    "a Private Ocean", "the First Train", "Faded Polaroids", "the Weather Station",
    "Quiet Thunder", "the Satellite Field", "a Door of Light", "the Afterimage",
    "the River at Dawn", "Low Summer Clouds", "the Far Shore", "the Orchard at Night",
  ],
  motions: [
    "Holding", "Crossing", "Tracing", "Waking", "Gathering", "Following",
    "Outrunning", "Turning Toward", "Listening Through", "Building",
    "Remembering", "Carrying", "Rewriting", "Finding", "Leaving",
    "Calling From", "Drifting Past", "Returning To", "Learning", "Mapping",
    "Unfolding", "Guarding", "Reading", "Chasing",
  ],
  states: [
    "Before the Rain", "Without Gravity", "After the Broadcast", "Under Soft Pressure",
    "Between Stations", "In Plain Sight", "Past the Blue Hour", "Before We Wake",
    "Under a Quiet Sun", "Beyond the Static", "Inside the Weather", "At Half Light",
    "With the Windows Open", "After the Long Silence", "Near the Waterline",
    "Until the Signal Returns", "Above the Sleeping Streets", "At the Edge of Morning",
    "Where the Air Changes", "When the City Exhales", "Under Northern Skies",
    "Before the Film Ends", "Outside the Frame", "Between Two Tides",
  ],
  templates: [
    (head, image) => `${head} Beneath ${image}`,
    (head, _image, _motion, state) => `${head} ${state}`,
    (_head, image, motion) => `${motion} ${image}`,
    (head, image) => `${image} After ${head}`,
    (head, image) => `${head} Beyond ${image}`,
  ],
};

const SPANISH: TitleLexicon = {
  heads: [
    "Clima Prestado", "Satélites de Papel", "Maquinaria Quieta", "Segundo Amanecer",
    "Estática de Plata", "Agua Abierta", "Geometría Suave", "Habitaciones Lejanas",
    "Señales sin Peso", "Frecuencia Salvaje", "Fuego Lento", "Jardines de Vidrio",
    "Mapas sin Escribir", "Luz Plegada", "Cielos Paralelos", "Voltaje Tierno",
    "Arquitectura Secreta", "Pequeñas Revoluciones", "Oro Desgastado", "Hilo Invisible",
    "Órbita Baja", "Distancia Azul", "Sueño Magnético", "Constelaciones Vacías",
  ],
  images: [
    "el Vidrio Azul", "el Último Andén", "las Ventanas con Lluvia", "una Ciudad Dormida",
    "la Señal del Norte", "las Lunas de Papel", "el Camino de Regreso", "las Cartas sin Enviar",
    "un Horizonte de Cobre", "el Cine Vacío", "los Espejos Nublados", "el Jardín del Techo",
    "un Océano Privado", "el Primer Tren", "las Fotos Desvaídas", "la Estación del Clima",
    "el Trueno Quieto", "el Campo de Satélites", "una Puerta de Luz", "la Imagen Persistente",
    "el Río al Amanecer", "las Nubes Bajas", "la Orilla Lejana", "el Huerto Nocturno",
  ],
  motions: [
    "Guardando", "Cruzando", "Trazando", "Despertando", "Reuniendo", "Siguiendo",
    "Dejando Atrás", "Girando Hacia", "Escuchando", "Construyendo", "Recordando",
    "Llevando", "Reescribiendo", "Encontrando", "Abandonando", "Llamando Desde",
    "Flotando Sobre", "Volviendo a", "Aprendiendo", "Cartografiando", "Desplegando",
    "Cuidando", "Leyendo", "Persiguiendo",
  ],
  states: [
    "Antes de la Lluvia", "Sin Gravedad", "Después de la Transmisión", "Bajo Presión Suave",
    "Entre Estaciones", "A Plena Vista", "Pasada la Hora Azul", "Antes de Despertar",
    "Bajo un Sol Quieto", "Más Allá de la Estática", "Dentro del Clima", "A Media Luz",
    "Con las Ventanas Abiertas", "Después del Silencio", "Cerca de la Orilla",
    "Hasta que Vuelva la Señal", "Sobre las Calles Dormidas", "Al Borde de la Mañana",
    "Donde Cambia el Aire", "Cuando Respira la Ciudad", "Bajo Cielos del Norte",
    "Antes del Final", "Fuera del Encuadre", "Entre Dos Mareas",
  ],
  templates: [
    (head, image) => `${head} Bajo ${lowerInitialArticle(image)}`,
    (head, _image, _motion, state) => `${head} ${state}`,
    (_head, image, motion) => `${motion} ${lowerInitialArticle(image)}`,
    (head, image) => `${image} Después de ${lowerInitialArticle(head)}`,
    (head, image) => `${head} Más Allá de ${lowerInitialArticle(image)}`,
  ],
};

function lowerInitialArticle(value: string): string {
  return value.replace(/^(El|La|Los|Las|Un|Una)\b/u, (article) => article.toLocaleLowerCase("es"));
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
  result = Math.imul(result, 0xc2b2ae35);
  result ^= result >>> 16;
  return result >>> 0;
}

function choose(values: readonly string[], material: string, salt: string): string {
  return values[hash(`${material}:${salt}`) % values.length];
}

function normalizeTitle(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, " ").trim();
}

export function deterministicCreativeTitle(input: CreativeTitleInput): string {
  if ((input.language !== "en" && input.language !== "es") || !input.seed.trim()) {
    throw new Error("creative_title_input");
  }
  const lexicon = input.language === "es" ? SPANISH : ENGLISH;
  const recent = new Set(
    input.recentTitles
      .filter((title): title is string => typeof title === "string")
      .map((title) => normalizeTitle(title).toLocaleLowerCase(input.language)),
  );
  const context = [...input.genres, ...input.moods]
    .filter((item): item is string => typeof item === "string")
    .slice(0, 8)
    .join("|")
    .toLocaleLowerCase(input.language);

  for (let attempt = 0; attempt < 96; attempt += 1) {
    const material = `${input.seed}|${context}|${attempt}`;
    const head = choose(lexicon.heads, material, "head");
    const image = choose(lexicon.images, material, "image");
    const motion = choose(lexicon.motions, material, "motion");
    const state = choose(lexicon.states, material, "state");
    const template = lexicon.templates[hash(`${material}:template`) % lexicon.templates.length];
    const candidate = normalizeTitle(template(head, image, motion, state));
    if (
      candidate.length >= 4 && candidate.length <= 60 &&
      !recent.has(candidate.toLocaleLowerCase(input.language))
    ) {
      return candidate;
    }
  }
  throw new Error("creative_title_exhausted");
}
