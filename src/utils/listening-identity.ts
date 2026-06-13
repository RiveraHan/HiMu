type Identity = { title: string; description: string };

const IDENTITIES: Record<string, Identity> = {
  ambient: {
    title: "Ethereal Architect",
    description:
      "Deep ambient, atmospheric textures, and expansive soundscapes.",
  },
  electronica: {
    title: "Pulse Driver",
    description: "Synthetic rhythms, neon nights, and kinetic energy.",
  },
  "neo-classical": {
    title: "Modern Romantic",
    description: "Piano, strings, and cinematic stillness.",
  },
  "lo-fi": {
    title: "Ethereal Architect",
    description:
      "Deep ambient, atmospheric textures, and expansive soundscapes.",
  },
  techno: {
    title: "Pulse Driver",
    description: "Relentless rhythms, dark warehouses, and kinetic energy.",
  },
  meditation: {
    title: "Still Mind",
    description: "Slow breath, deep frequencies, and inner silence.",
  },
};

const DEFAULT_IDENTITY: Identity = {
  title: "Sound Explorer",
  description: "Your listening identity takes shape as you play more music.",
};

export const getListeningIdentity = (genre: string | null): Identity =>
  (genre && IDENTITIES[genre.toLowerCase()]) || DEFAULT_IDENTITY;
