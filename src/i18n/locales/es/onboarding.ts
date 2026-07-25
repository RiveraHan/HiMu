export const onboarding = {
  welcome: {
    eyebrow: "BIENVENIDO A HIMU",
    pages: {
      intro: {
        title: "TU MÚSICA, EN EL MOMENTO JUSTO",
        body: "HiMu combina música creada con IA, selecciones curadas y herramientas de escucha según tu estado de ánimo.",
      },
      djs: {
        title: "CONOCE A TUS DJS CON IA",
        body: "Cada DJ tiene un sonido y una personalidad únicos. Escucha, guarda tus pistas favoritas y da forma a lo que sigue.",
      },
    },
    pageCount: "Página {{page}} de {{count}}",
    actions: {
      skip: "Omitir",
      back: "Atrás",
      continue: "Continuar",
      showAround: "Conocer HiMu",
    },
    accessibility: {
      announcement: "{{title}}. {{body}} Página {{page}} de {{count}}",
      skip: "Omitir introducción",
      back: "Volver a la página {{page}} de la introducción",
      continue: "Continuar introducción",
      showAround: "Conocer HiMu",
    },
  },
  home: {
    dailyDrop: {
      title: "EMPIEZA AQUÍ",
      description: "Tu Daily Drop es una pista nueva elegida para este momento.",
    },
    djs: {
      title: "MENTES DISTINTAS, SONIDOS DISTINTOS",
      description: "Cada DJ con IA tiene un sonido y una personalidad propios.",
    },
    discover: {
      title: "VE MÁS ALLÁ DE TU FEED",
      description: "Busca y explora más música cuando quieras.",
    },
  },
  contextual: {
    discoverSearch: {
      title: "EXPLORA TODO EL SONIDO",
      description: "Encuentra pistas, ambientes y artistas más allá de Inicio.",
    },
    djHero: {
      title: "CONOCE A TU DJ",
      description: "Cada DJ tiene personalidad, sonido y una conexión que evoluciona con tus gustos.",
    },
  },
  tooltip: {
    eyebrow: "TOUR GUIADO",
    stepCount: "Paso {{step}} de {{count}}",
    progress: "Progreso del tour, paso {{step}} de {{count}}",
    interactionHint: "Toca el área resaltada o usa Siguiente",
    actions: {
      back: "Atrás",
      skip: "Omitir",
      next: "Siguiente",
    },
    accessibility: {
      announcement: "{{title}}. {{description}} Paso {{step}} de {{count}}",
      back: "Volver al paso {{step}} del tour",
      skip: "Omitir tour",
      next: "Ir al paso {{step}} del tour",
      finish: "Finalizar pasos del tour",
    },
  },
  continueTour: {
    eyebrow: "TOUR GUIADO",
    title: "SIGUE EXPLORANDO HIMU",
    body: "Retoma donde lo dejaste.",
    actions: {
      continue: "Continuar tour",
      end: "Finalizar tour",
    },
    accessibility: {
      continue: "Continuar tour guiado",
      dismiss: "Descartar tour guiado",
    },
  },
  completion: {
    eyebrow: "TOUR COMPLETADO",
    title: "YA ESTÁS LISTO",
    body: "HiMu mejora cuanto más escuchas. Empieza con el sonido de hoy y hazlo tuyo.",
    announcement: "Ya estás listo. Tour guiado completado.",
    accessibility: "Ya estás listo. HiMu mejora cuanto más escuchas. Empieza con el sonido de hoy y hazlo tuyo.",
    actions: {
      playToday: "Reproducir la selección de hoy",
      finish: "Finalizar",
    },
  },
  replay: {
    action: "Repetir tour del producto",
  },
} as const;
