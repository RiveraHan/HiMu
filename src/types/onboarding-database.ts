import type { Database as GeneratedDatabase, Json } from "./database";

type UserOnboardingTable = {
  Row: {
    user_id: string;
    version: number;
    status: string;
    last_step: string | null;
    started_at: string;
    completed_at: string | null;
    skipped_at: string | null;
    first_play_at: string | null;
    contextual_tips: Json;
    replay_count: number;
    last_replayed_at: string | null;
    updated_at: string;
  };
  Insert: {
    user_id: string;
    version: number;
    status: string;
    last_step?: string | null;
    started_at?: string;
    completed_at?: string | null;
    skipped_at?: string | null;
    first_play_at?: string | null;
    contextual_tips?: Json;
    replay_count?: number;
    last_replayed_at?: string | null;
    updated_at?: string;
  };
  Update: {
    user_id?: string;
    version?: number;
    status?: string;
    last_step?: string | null;
    started_at?: string;
    completed_at?: string | null;
    skipped_at?: string | null;
    first_play_at?: string | null;
    contextual_tips?: Json;
    replay_count?: number;
    last_replayed_at?: string | null;
    updated_at?: string;
  };
  Relationships: [
    {
      foreignKeyName: "user_onboarding_user_id_fkey";
      columns: ["user_id"];
      isOneToOne: false;
      referencedRelation: "profiles";
      referencedColumns: ["id"];
    },
  ];
};

type GeneratedPublic = GeneratedDatabase["public"];

/**
 * Tracked supplement for migrations that cannot enter the generated database
 * file until local/linked Supabase type generation is available.
 */
export type OnboardingDatabase = Omit<GeneratedDatabase, "public"> & {
  public: Omit<GeneratedPublic, "Tables"> & {
    Tables: GeneratedPublic["Tables"] & {
      user_onboarding: UserOnboardingTable;
    };
  };
};
