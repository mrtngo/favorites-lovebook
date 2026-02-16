# Favorites Lovebook (Next.js)

A separate app for saving personal preferences and important reminders:

- Important dates (Valentine's, birthday, Christmas, etc.)
- Favorite gifts
- Favorite destinations
- Favorite flowers
- Date ideas and little things
- Favorite movies (OMDb/IMDb lookup)
- Favorite TV shows (OMDb/IMDb lookup)
- Favorite songs (Spotify lookup)
- Favorite YouTube videos (YouTube API lookup)
- Shared notes
- Per-user dashboard color palettes
- Couple sharing (create a shared space and join by invite code)

All data is stored in Supabase (Auth + Postgres + RLS), scoped to a shared couple space.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` with:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_SITE_URL=https://vdpmgodatabase.vercel.app
   OMDB_API_KEY=...
   SPOTIFY_CLIENT_ID=...
   SPOTIFY_CLIENT_SECRET=...
   YOUTUBE_API_KEY=...
   ```
3. Run migrations (after linking project):
   ```bash
   npx supabase db push
   ```
4. Start dev server:
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000)

## Deploy to Vercel

1. Push this project folder to a Git repository.
2. Import the repository in Vercel.
3. Add Supabase env vars in Vercel project settings.
4. Deploy.
