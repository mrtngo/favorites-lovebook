-- Per-user dashboard palette settings.

alter table public.user_notes
add column if not exists palette_bg_a text not null default '#2a0f31',
add column if not exists palette_bg_b text not null default '#5d1842',
add column if not exists palette_bg_c text not null default '#1d2249',
add column if not exists palette_accent text not null default '#ffc86f',
add column if not exists palette_accent_2 text not null default '#ffdbe9';
