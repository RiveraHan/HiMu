export const common = {
  actions: {
    back: "Atrás",
    close: "Cerrar",
    cancel: "Cancelar",
    confirm: "Confirmar",
    retry: "Reintentar",
    dismiss: "Descartar",
    play: "Reproducir",
    pause: "Pausar",
    next: "Siguiente",
    previous: "Anterior",
    remove: "Eliminar",
  },
  states: {
    loading: "Cargando",
    empty: "Sin contenido",
  },
  errors: {
    generic: "Algo salió mal. Inténtalo de nuevo.",
    savePreference: "No pudimos sincronizar tu preferencia. Se conservará en este dispositivo.",
  },
} as const;
