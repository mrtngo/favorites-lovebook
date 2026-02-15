# Favorites Lovebook (Next.js)

A separate app for saving personal preferences and important reminders:

- Important dates (Valentine's, birthday, Christmas, etc.)
- Favorite gifts
- Favorite destinations
- Favorite flowers
- Date ideas and little things
- Free-form notes

All data is stored per-user in Supabase (Auth + Postgres + RLS).

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env.local` with:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
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
