-- Add media-friendly categories and metadata for API-backed favorites.

alter table public.favorite_items
add column if not exists subtitle text not null default '',
add column if not exists source text not null default 'manual',
add column if not exists external_id text not null default '',
add column if not exists external_url text not null default '',
add column if not exists image_url text not null default '';

alter table public.favorite_items
drop constraint if exists favorite_items_category_check;

alter table public.favorite_items
add constraint favorite_items_category_check
check (
  category in (
    'gifts',
    'destinations',
    'flowers',
    'dateIdeas',
    'littleThings',
    'movies',
    'tvShows',
    'songs',
    'youtubeVideos'
  )
);

alter table public.favorite_items
drop constraint if exists favorite_items_source_check;

alter table public.favorite_items
add constraint favorite_items_source_check
check (
  source in (
    'manual',
    'imdb_movie',
    'imdb_tv',
    'spotify_track',
    'youtube_video'
  )
);

create index if not exists idx_favorite_items_source on public.favorite_items(source);
