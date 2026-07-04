## Summary

This PR enhances DJ management with **security hardening**, **AI-powered content generation**, and **playback improvements**.

### Key Changes

**Security & Data**
- Row-level security (RLS) policies for user data
- Public profile table with visibility controls
- DJ listen tracking with RLS enforcement

**AI & Generation**
- Edge functions for DJ creation/deletion with quotas
- Music generation pipeline (Replicate → R2 → Supabase)
- Scripts for avatars, covers, playlists, and cleanup

**Playback & UX**
- Repeat mode for player control
- Focus Mode with focus tracks
- AI Mixes integration on HomeScreen
- Enhanced query keys for tracks and generation jobs

### Stats
- **+3,299 / -327** lines
- **59** files changed
- **26** commits

### Review Checklist
- [ ] Verify RLS policies in migrations
- [ ] Confirm Replicate/R2/Supabase credentials
- [ ] Test DJ creation/deletion flow
- [ ] Validate generation job polling
- [ ] Check cascade delete impact
