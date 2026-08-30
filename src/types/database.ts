export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      avatar_regens: {
        Row: {
          created_at: string
          dj_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          dj_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          dj_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avatar_regens_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "djs"
            referencedColumns: ["id"]
          },
        ]
      }
      communities: {
        Row: {
          cover_image: string | null
          created_at: string | null
          description: string | null
          id: string
          member_count: number | null
          name: string
          slug: string
        }
        Insert: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          member_count?: number | null
          name: string
          slug: string
        }
        Update: {
          cover_image?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          member_count?: number | null
          name?: string
          slug?: string
        }
        Relationships: []
      }
      community_members: {
        Row: {
          community_id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          community_id: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          community_id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_members_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "community_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cover_regens: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          status: string
          track_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          track_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          track_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cover_regens_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      creative_draft_events: {
        Row: {
          created_at: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: []
      }
      creators: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          follower_count: number | null
          id: string
          name: string
          slug: string
          social_links: Json | null
          verified: boolean | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          name: string
          slug: string
          social_links?: Json | null
          verified?: boolean | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          follower_count?: number | null
          id?: string
          name?: string
          slug?: string
          social_links?: Json | null
          verified?: boolean | null
        }
        Relationships: []
      }
      dj_generation_configs: {
        Row: {
          base_prompt: string
          created_at: string | null
          default_lyrics: string | null
          dj_id: string
          is_instrumental: boolean | null
          max_duration: number | null
          temperature: number | null
          updated_at: string | null
          voice_id: string | null
        }
        Insert: {
          base_prompt: string
          created_at?: string | null
          default_lyrics?: string | null
          dj_id: string
          is_instrumental?: boolean | null
          max_duration?: number | null
          temperature?: number | null
          updated_at?: string | null
          voice_id?: string | null
        }
        Update: {
          base_prompt?: string
          created_at?: string | null
          default_lyrics?: string | null
          dj_id?: string
          is_instrumental?: boolean | null
          max_duration?: number | null
          temperature?: number | null
          updated_at?: string | null
          voice_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_generation_configs_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: true
            referencedRelation: "djs"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_interactions: {
        Row: {
          created_at: string | null
          dj_id: string | null
          id: string
          message: string
          response: string | null
          type: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          dj_id?: string | null
          id?: string
          message: string
          response?: string | null
          type?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          dj_id?: string | null
          id?: string
          message?: string
          response?: string | null
          type?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_interactions_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "djs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_listens: {
        Row: {
          dj_id: string
          first_listened_at: string
          user_id: string
        }
        Insert: {
          dj_id: string
          first_listened_at?: string
          user_id: string
        }
        Update: {
          dj_id?: string
          first_listened_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dj_listens_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "djs"
            referencedColumns: ["id"]
          },
        ]
      }
      djs: {
        Row: {
          avatar_url: string | null
          character: string | null
          created_at: string | null
          genre_specialties: string[] | null
          id: string
          identity_concept: string | null
          is_premium: boolean | null
          is_public: boolean
          mood_tags: string[] | null
          name: string
          owner_id: string | null
          personality_traits: Json | null
          slug: string
          voice_style: string | null
        }
        Insert: {
          avatar_url?: string | null
          character?: string | null
          created_at?: string | null
          genre_specialties?: string[] | null
          id?: string
          identity_concept?: string | null
          is_premium?: boolean | null
          is_public?: boolean
          mood_tags?: string[] | null
          name: string
          owner_id?: string | null
          personality_traits?: Json | null
          slug: string
          voice_style?: string | null
        }
        Update: {
          avatar_url?: string | null
          character?: string | null
          created_at?: string | null
          genre_specialties?: string[] | null
          id?: string
          identity_concept?: string | null
          is_premium?: boolean | null
          is_public?: boolean
          mood_tags?: string[] | null
          name?: string
          owner_id?: string | null
          personality_traits?: Json | null
          slug?: string
          voice_style?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          album_art_url: string | null
          artist: string
          audio_url: string
          created_at: string | null
          duration: number | null
          genre: string | null
          id: string
          title: string
          track_id: string
          user_id: string
        }
        Insert: {
          album_art_url?: string | null
          artist: string
          audio_url: string
          created_at?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          title: string
          track_id: string
          user_id: string
        }
        Update: {
          album_art_url?: string | null
          artist?: string
          audio_url?: string
          created_at?: string | null
          duration?: number | null
          genre?: string | null
          id?: string
          title?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string | null
          creator_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_jobs: {
        Row: {
          caption: string | null
          caption_audio_url: string | null
          created_at: string
          dj_id: string
          drop_date: string | null
          error: string | null
          generation_brief: Json | null
          id: string
          is_public: boolean
          prompt: string | null
          source_track_id: string | null
          status: string
          track_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          caption_audio_url?: string | null
          created_at?: string
          dj_id: string
          drop_date?: string | null
          error?: string | null
          generation_brief?: Json | null
          id?: string
          is_public?: boolean
          prompt?: string | null
          source_track_id?: string | null
          status?: string
          track_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          caption_audio_url?: string | null
          created_at?: string
          dj_id?: string
          drop_date?: string | null
          error?: string | null
          generation_brief?: Json | null
          id?: string
          is_public?: boolean
          prompt?: string | null
          source_track_id?: string | null
          status?: string
          track_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generation_jobs_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "djs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_source_track_id_fkey"
            columns: ["source_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generation_jobs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_events: {
        Row: {
          created_at: string
          event: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          event?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listening_events_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      listening_stats: {
        Row: {
          date: string
          id: string
          minutes_listened: number | null
          top_genre: string | null
          tracks_played: number | null
          user_id: string | null
        }
        Insert: {
          date: string
          id?: string
          minutes_listened?: number | null
          top_genre?: string | null
          tracks_played?: number | null
          user_id?: string | null
        }
        Update: {
          date?: string
          id?: string
          minutes_listened?: number | null
          top_genre?: string | null
          tracks_played?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "listening_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          created_at: string | null
          description: string | null
          dj_id: string | null
          ended_at: string | null
          host_id: string | null
          id: string
          listener_count: number | null
          started_at: string | null
          status: string | null
          stream_url: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          dj_id?: string | null
          ended_at?: string | null
          host_id?: string | null
          id?: string
          listener_count?: number | null
          started_at?: string | null
          status?: string | null
          stream_url?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          dj_id?: string | null
          ended_at?: string | null
          host_id?: string | null
          id?: string
          listener_count?: number | null
          started_at?: string | null
          status?: string | null
          stream_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "djs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_sessions_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      music_preferences: {
        Row: {
          ai_frequency: string | null
          atmosphere: string
          bpm_range: Json | null
          discovery_depth: boolean | null
          focus_modes: Json | null
          genres: string[] | null
          moods: string[] | null
          updated_at: string | null
          user_id: string
          vibe_mapping: Json | null
        }
        Insert: {
          ai_frequency?: string | null
          atmosphere?: string
          bpm_range?: Json | null
          discovery_depth?: boolean | null
          focus_modes?: Json | null
          genres?: string[] | null
          moods?: string[] | null
          updated_at?: string | null
          user_id: string
          vibe_mapping?: Json | null
        }
        Update: {
          ai_frequency?: string | null
          atmosphere?: string
          bpm_range?: Json | null
          discovery_depth?: boolean | null
          focus_modes?: Json | null
          genres?: string[] | null
          moods?: string[] | null
          updated_at?: string | null
          user_id?: string
          vibe_mapping?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "music_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      playlist_tracks: {
        Row: {
          added_at: string | null
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          added_at?: string | null
          playlist_id: string
          position: number
          track_id: string
        }
        Update: {
          added_at?: string | null
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "playlist_tracks_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playlist_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      playlists: {
        Row: {
          cover_url: string | null
          created_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          user_id: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          user_id?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playlists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          community_id: string | null
          content: string
          created_at: string | null
          id: string
          media_url: string | null
          user_id: string | null
        }
        Insert: {
          community_id?: string | null
          content: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          user_id?: string | null
        }
        Update: {
          community_id?: string | null
          content?: string
          created_at?: string | null
          id?: string
          media_url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "posts_community_id_fkey"
            columns: ["community_id"]
            isOneToOne: false
            referencedRelation: "communities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_events: {
        Row: {
          created_at: string
          event_id: string
          event_name: string
          installation_id: string
          occurred_at: string
          properties: Json
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_id: string
          event_name: string
          installation_id: string
          occurred_at: string
          properties?: Json
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_id?: string
          event_name?: string
          installation_id?: string
          occurred_at?: string
          properties?: Json
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          display_name: string | null
          id: string
          preferences: Json | null
          subscription_tier: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id: string
          preferences?: Json | null
          subscription_tier?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          display_name?: string | null
          id?: string
          preferences?: Json | null
          subscription_tier?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      provider_usage_events: {
        Row: {
          created_at: string
          id: string
          idempotency_key: string
          operation: string
          quota_bucket: string
          resource_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          idempotency_key: string
          operation: string
          quota_bucket: string
          resource_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          idempotency_key?: string
          operation?: string
          quota_bucket?: string
          resource_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          id: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          id?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_listeners: {
        Row: {
          joined_at: string | null
          session_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string | null
          session_id: string
          user_id: string
        }
        Update: {
          joined_at?: string | null
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_listeners_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_listeners_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      track_private_details: {
        Row: {
          confirmed_lyrics: string
          created_at: string
          owner_id: string
          track_id: string
        }
        Insert: {
          confirmed_lyrics: string
          created_at?: string
          owner_id: string
          track_id: string
        }
        Update: {
          confirmed_lyrics?: string
          created_at?: string
          owner_id?: string
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "track_private_details_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: true
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      tracks: {
        Row: {
          album: string | null
          album_art_url: string | null
          artist: string
          audio_url: string | null
          bpm: number | null
          created_at: string | null
          creator_id: string | null
          dj_id: string | null
          duration: number | null
          energy_level: number | null
          external_id: string | null
          genre: string | null
          id: string
          is_ai_generated: boolean | null
          is_public: boolean
          key: string | null
          mood_tags: string[] | null
          owner_id: string | null
          source: string | null
          source_track_id: string | null
          title: string
        }
        Insert: {
          album?: string | null
          album_art_url?: string | null
          artist: string
          audio_url?: string | null
          bpm?: number | null
          created_at?: string | null
          creator_id?: string | null
          dj_id?: string | null
          duration?: number | null
          energy_level?: number | null
          external_id?: string | null
          genre?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean
          key?: string | null
          mood_tags?: string[] | null
          owner_id?: string | null
          source?: string | null
          source_track_id?: string | null
          title: string
        }
        Update: {
          album?: string | null
          album_art_url?: string | null
          artist?: string
          audio_url?: string | null
          bpm?: number | null
          created_at?: string | null
          creator_id?: string | null
          dj_id?: string | null
          duration?: number | null
          energy_level?: number | null
          external_id?: string | null
          genre?: string | null
          id?: string
          is_ai_generated?: boolean | null
          is_public?: boolean
          key?: string | null
          mood_tags?: string[] | null
          owner_id?: string | null
          source?: string | null
          source_track_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracks_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_dj_id_fkey"
            columns: ["dj_id"]
            isOneToOne: false
            referencedRelation: "djs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracks_source_track_id_fkey"
            columns: ["source_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      user_experience_state: {
        Row: {
          first_owned_track_id: string | null
          first_owned_track_ready_at: string | null
          intro_version_seen: number
          preference_nudge_completed_at: string | null
          preference_nudge_dismissed_at: string | null
          preference_nudge_shown_at: string | null
          preference_nudge_status: string
          preference_nudge_track_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          first_owned_track_id?: string | null
          first_owned_track_ready_at?: string | null
          intro_version_seen?: number
          preference_nudge_completed_at?: string | null
          preference_nudge_dismissed_at?: string | null
          preference_nudge_shown_at?: string | null
          preference_nudge_status?: string
          preference_nudge_track_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          first_owned_track_id?: string | null
          first_owned_track_ready_at?: string | null
          intro_version_seen?: number
          preference_nudge_completed_at?: string | null
          preference_nudge_dismissed_at?: string | null
          preference_nudge_shown_at?: string | null
          preference_nudge_status?: string
          preference_nudge_track_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_experience_state_first_owned_track_id_fkey"
            columns: ["first_owned_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_experience_state_preference_nudge_track_id_fkey"
            columns: ["preference_nudge_track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_experience_state_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_onboarding: {
        Row: {
          completed_at: string | null
          contextual_tips: Json
          first_play_at: string | null
          last_replayed_at: string | null
          last_step: string | null
          replay_count: number
          skipped_at: string | null
          started_at: string
          status: string
          updated_at: string
          user_id: string
          version: number
        }
        Insert: {
          completed_at?: string | null
          contextual_tips?: Json
          first_play_at?: string | null
          last_replayed_at?: string | null
          last_step?: string | null
          replay_count?: number
          skipped_at?: string | null
          started_at?: string
          status: string
          updated_at?: string
          user_id: string
          version: number
        }
        Update: {
          completed_at?: string | null
          contextual_tips?: Json
          first_play_at?: string | null
          last_replayed_at?: string | null
          last_step?: string | null
          replay_count?: number
          skipped_at?: string | null
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_onboarding_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      fail_cover_generation_reservation: {
        Args: {
          p_failed_at: string
          p_reservation_id: string
          p_user_id: string
        }
        Returns: boolean
      }
      finalize_cover_regeneration: {
        Args: {
          p_album_art_url: string
          p_finished_at: string
          p_reservation_id: string
          p_track_id: string
          p_user_id: string
        }
        Returns: string
      }
      finalize_generated_mix: {
        Args: {
          p_album_art_url: string
          p_artist: string
          p_audio_url: string
          p_caption: string
          p_caption_audio_url: string
          p_dj_id: string
          p_duration: number
          p_finished_at: string
          p_genre: string
          p_job_id: string
          p_mood_tags: string[]
          p_started_at: string
          p_title: string
          p_track_id: string
        }
        Returns: {
          job_id: string
          track_id: string
          track_title: string
        }[]
      }
      generation_quota_usage: {
        Args: { p_at?: string; p_user_id: string }
        Returns: number
      }
      record_listening_stats: {
        Args: { p_minutes: number; p_top_genre?: string; p_tracks: number }
        Returns: undefined
      }
      record_product_event: {
        Args: {
          p_event_id: string
          p_event_name: string
          p_installation_id: string
          p_occurred_at: string
          p_properties: Json
          p_session_id: string
          p_user_id: string
        }
        Returns: string
      }
      reserve_avatar_generation: {
        Args: { p_operation: string; p_request_id: string; p_user_id: string }
        Returns: {
          daily_limit: number
          event_id: string
          outcome: string
          resource_id: string
        }[]
      }
      reserve_cover_generation: {
        Args: { p_track_id: string; p_user_id: string }
        Returns: {
          daily_limit: number
          outcome: string
          reservation_id: string
        }[]
      }
      reserve_creative_draft: {
        Args: { p_kind: string; p_request_id: string; p_user_id: string }
        Returns: {
          daily_limit: number
          event_id: string
          outcome: string
          resource_id: string
        }[]
      }
      reserve_daily_generation_job: {
        Args: { p_dj_id: string; p_drop_date: string; p_user_id: string }
        Returns: {
          daily_limit: number
          dj_id: string
          is_public: boolean
          job_id: string
          outcome: string
          queued_at: string
          status: string
          updated_at: string
        }[]
      }
      reserve_manual_generation_job: {
        Args: {
          p_dj_id: string
          p_generation_brief: Json
          p_is_public: boolean
          p_source_track_id: string
          p_user_id: string
        }
        Returns: {
          daily_limit: number
          generation_brief: Json
          is_public: boolean
          job_id: string
          outcome: string
          queued_at: string
          source_track_id: string
        }[]
      }
      reserve_provider_usage_event: {
        Args: {
          p_idempotency_key: string
          p_operation: string
          p_quota_bucket: string
          p_resource_id?: string
          p_user_id: string
        }
        Returns: {
          daily_limit: number
          event_id: string
          outcome: string
          resource_id: string
        }[]
      }
      claim_user_preference_nudge: {
        Args: { p_track_id: string; p_user_id: string }
        Returns: {
          applied: boolean
          state: Json
        }[]
      }
      retry_legacy_manual_generation_job: {
        Args: { p_dj_id: string; p_job_id: string; p_user_id: string }
        Returns: {
          daily_limit: number
          is_public: boolean
          job_id: string
          outcome: string
          prompt: string
          queued_at: string
        }[]
      }
      transition_user_experience: {
        Args: {
          p_action: string
          p_intro_version: number
          p_track_id: string
          p_user_id: string
        }
        Returns: {
          first_owned_track_id: string | null
          first_owned_track_ready_at: string | null
          intro_version_seen: number
          preference_nudge_completed_at: string | null
          preference_nudge_dismissed_at: string | null
          preference_nudge_shown_at: string | null
          preference_nudge_status: string
          preference_nudge_track_id: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "user_experience_state"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
