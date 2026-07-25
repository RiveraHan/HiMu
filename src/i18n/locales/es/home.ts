export const home = {
  greeting: {
    morning: "Buenos días",
    afternoon: "Buenas tardes",
    evening: "Buenas noches",
  },
  subtitle: "Tu entorno sonoro te espera.",
  openProfile: "Abrir tu perfil",
  dailyDrop: {
    eyebrow: "LANZAMIENTO DE HOY",
    fresh: "Fresco, solo para ti",
    making: "Creando el lanzamiento de hoy…",
  },
  hero: {
    live: "EN VIVO",
    onAir: "AL AIRE",
    playTrack: "Reproducir {{trackTitle}} de {{djName}}",
  },
  yourDjs: "Tus DJs",
  newDj: "Nuevo DJ",
  create: "Crear",
  djLimit: {
    title: "Límite de DJs alcanzado",
    message: "Ya tienes 2 DJs. Elimina uno para crear otro.",
  },
  freshFrequencies: "Lo nuevo de tus DJs",
  forYou: "Para ti",
  library: {
    title: "Biblioteca personalizada",
    generated: "GENERADO",
    aiMixes: "Mezclas con IA",
    saved: "GUARDADO",
    favorites: "Favoritos",
    noFavorites: "Aún no hay favoritos",
  },
  vibe: {
    open: "Abrir tu Vibe Check",
    thisWeek: "ESTA SEMANA",
    hours: "HORAS",
    mostly: "Principalmente {{genre}}",
    streak_one: "Racha de {{count}} día",
    streak_other: "Racha de {{count}} días",
  },
  focus: {
    title: "Modo concentración",
    subtitle: "Música y un temporizador para concentrarte",
    start: "Iniciar una sesión de concentración",
  },
  captionVoice: {
    stop: "Detener al DJ",
    hear: "Escuchar al DJ",
  },
  timeOfDay: {
    morning: {
      headline: "Comienza la mañana a tu ritmo.",
      label: "Para tu mañana",
    },
    afternoon: {
      headline: "Mantén el ritmo de tu tarde.",
      label: "Para tu tarde",
    },
    evening: {
      headline: "Algo cálido para terminar el día.",
      label: "Para tu noche",
    },
    lateNight: {
      headline: "Frecuencias nocturnas, solo para ti.",
      label: "Madrugada",
    },
  },
} as const;
