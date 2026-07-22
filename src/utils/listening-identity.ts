export type ListeningIdentityId =
  | "etherealArchitect"
  | "pulseDriver"
  | "modernRomantic"
  | "stillMind"
  | "soundExplorer";

type ListeningIdentity = { id: ListeningIdentityId };

const IDENTITIES: Record<string, ListeningIdentity> = {
  ambient: { id: "etherealArchitect" },
  electronica: { id: "pulseDriver" },
  "neo-classical": { id: "modernRomantic" },
  "lo-fi": { id: "etherealArchitect" },
  techno: { id: "pulseDriver" },
  meditation: { id: "stillMind" },
};

const DEFAULT_IDENTITY: ListeningIdentity = { id: "soundExplorer" };

export const getListeningIdentity = (genre: string | null): ListeningIdentity =>
  (genre && IDENTITIES[genre.toLowerCase()]) || DEFAULT_IDENTITY;
