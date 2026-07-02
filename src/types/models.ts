// src/types/models.ts
// App-level models derived from database schema
// These use camelCase and omit fields that are auto-managed by the database

export type SubscriptionTier = 'free' | 'premium';

export type SessionStatus = 'scheduled' | 'live' | 'ended';

export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  albumArtUrl?: string;
  audioUrl?: string;
  duration?: number; // seconds
  bpm?: number;
  key?: string;
  genre?: string;
  moodTags?: string[];
  energyLevel?: number;
  isAIGenerated: boolean;
  djId?: string;
  creatorId?: string;
  createdAt?: string;
}

export interface DJ {
  id: string;
  name: string;
  slug: string;
  character?: string;
  voiceStyle?: string;
  avatarUrl?: string;
  genreSpecialties?: string[];
  moodTags?: string[];
  isPremium: boolean;
  personalityTraits?: Record<string, unknown>;
  createdAt?: string;
}

export interface DJConfig {
  djId: string;
  basePrompt: string;
  defaultLyrics?: string;
  isInstrumental: boolean;
  voiceId?: string;
  temperature?: number;
  maxDuration?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface Creator {
  id: string;
  name: string;
  slug: string;
  bio?: string;
  avatarUrl?: string;
  verified: boolean;
  socialLinks?: Record<string, unknown>;
  followerCount?: number;
  createdAt?: string;
}

export interface Playlist {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  coverUrl?: string;
  isPublic: boolean;
  createdAt?: string;
}

export interface PlaylistTrack {
  playlistId: string;
  trackId: string;
  position: number;
  addedAt?: string;
}

export interface LiveSession {
  id: string;
  djId?: string;
  hostId?: string;
  title: string;
  description?: string;
  status: SessionStatus;
  startedAt?: string;
  endedAt?: string;
  streamUrl?: string;
  listenerCount?: number;
  createdAt?: string;
}

export interface SessionListener {
  sessionId: string;
  userId: string;
  joinedAt?: string;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  subscriptionTier?: SubscriptionTier;
  preferences?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface Follow {
  userId: string;
  creatorId: string;
  createdAt?: string;
}

export interface Community {
  id: string;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  memberCount?: number;
  createdAt?: string;
}

export interface CommunityMember {
  communityId: string;
  userId: string;
  role: 'member' | 'moderator' | 'admin';
  joinedAt?: string;
}

export interface Post {
  id: string;
  communityId?: string;
  userId?: string;
  content: string;
  mediaUrl?: string;
  createdAt?: string;
}

export interface DJInteraction {
  id: string;
  userId: string;
  djId: string;
  message: string;
  response?: string;
  type: 'chat' | 'request' | 'feedback';
  createdAt?: string;
}

export interface ListeningStats {
  id: string;
  userId?: string;
  date: string;
  minutesListened?: number;
  tracksPlayed?: number;
  topGenre?: string;
}

export interface MusicPreferences {
  userId: string;
  genres?: string[];
  moods?: string[];
  bpmRange?: { min: number; max: number };
  focusModes?: { work?: boolean; sleep?: boolean; exercise?: boolean; relax?: boolean };
  updatedAt?: string;
}
