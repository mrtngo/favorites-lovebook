import { NextResponse } from "next/server";

export const runtime = "nodejs";

type CatalogCategory = "movies" | "tvShows" | "songs" | "youtubeVideos";
type FavoriteSource =
  | "manual"
  | "imdb_movie"
  | "imdb_tv"
  | "spotify_track"
  | "youtube_video";

type CatalogResult = {
  id: string;
  title: string;
  subtitle: string;
  details: string;
  imageUrl: string;
  externalUrl: string;
  source: FavoriteSource;
};

type OmdbSearchResponse = {
  Response: "True" | "False";
  Error?: string;
  Search?: Array<{
    Title: string;
    Year: string;
    imdbID: string;
    Poster: string;
  }>;
};

type SpotifyTokenResponse = {
  access_token?: string;
  expires_in?: number;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      id: string;
      name: string;
      artists?: Array<{ name: string }>;
      album?: {
        name?: string;
        release_date?: string;
        images?: Array<{ url: string }>;
      };
      external_urls?: {
        spotify?: string;
      };
    }>;
  };
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: {
      videoId?: string;
    };
    snippet?: {
      title?: string;
      channelTitle?: string;
      publishedAt?: string;
      thumbnails?: {
        medium?: { url?: string };
        high?: { url?: string };
        default?: { url?: string };
      };
    };
  }>;
};

let spotifyTokenCache: { token: string; expiresAtMs: number } | null = null;

function isCatalogCategory(value: string | null): value is CatalogCategory {
  return (
    value === "movies" ||
    value === "tvShows" ||
    value === "songs" ||
    value === "youtubeVideos"
  );
}

function safeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function omdbImageUrl(poster: string) {
  const trimmed = safeText(poster);
  return trimmed === "N/A" ? "" : trimmed;
}

async function searchOmdb(query: string, type: "movie" | "series"): Promise<CatalogResult[]> {
  const omdbApiKey = process.env.OMDB_API_KEY;
  if (!omdbApiKey) {
    throw new Error("OMDB_API_KEY is missing on server.");
  }

  const endpoint = new URL("https://www.omdbapi.com/");
  endpoint.searchParams.set("apikey", omdbApiKey);
  endpoint.searchParams.set("s", query);
  endpoint.searchParams.set("type", type);

  const response = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("OMDb request failed.");
  }

  const payload = (await response.json()) as OmdbSearchResponse;
  if (payload.Response === "False") {
    return [];
  }

  const source: FavoriteSource = type === "movie" ? "imdb_movie" : "imdb_tv";

  return (payload.Search ?? []).map((item) => ({
    id: safeText(item.imdbID),
    title: safeText(item.Title),
    subtitle: safeText(item.Year),
    details: `IMDb`,
    imageUrl: omdbImageUrl(item.Poster),
    externalUrl: `https://www.imdb.com/title/${safeText(item.imdbID)}/`,
    source,
  }));
}

async function getSpotifyAccessToken() {
  const now = Date.now();
  if (spotifyTokenCache && now < spotifyTokenCache.expiresAtMs - 30000) {
    return spotifyTokenCache.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET is missing on server.");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    throw new Error("Spotify auth request failed.");
  }

  const tokenPayload = (await tokenRes.json()) as SpotifyTokenResponse;
  const accessToken = safeText(tokenPayload.access_token);
  const expiresIn = tokenPayload.expires_in ?? 0;

  if (!accessToken || !expiresIn) {
    throw new Error("Spotify auth response was invalid.");
  }

  spotifyTokenCache = {
    token: accessToken,
    expiresAtMs: Date.now() + expiresIn * 1000,
  };

  return accessToken;
}

async function searchSpotifyTracks(query: string): Promise<CatalogResult[]> {
  const accessToken = await getSpotifyAccessToken();
  const endpoint = new URL("https://api.spotify.com/v1/search");
  endpoint.searchParams.set("q", query);
  endpoint.searchParams.set("type", "track");
  endpoint.searchParams.set("limit", "8");

  const response = await fetch(endpoint.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Spotify search request failed.");
  }

  const payload = (await response.json()) as SpotifySearchResponse;

  return (payload.tracks?.items ?? []).map((track) => {
    const artists = (track.artists ?? [])
      .map((artist) => safeText(artist.name))
      .filter(Boolean)
      .join(", ");
    const albumName = safeText(track.album?.name);
    const releaseDate = safeText(track.album?.release_date);
    const subtitleParts = [artists, albumName].filter(Boolean);
    const detailsParts = ["Spotify track", releaseDate ? `Released ${releaseDate}` : ""].filter(
      Boolean,
    );
    const imageUrl =
      safeText(track.album?.images?.[1]?.url) ||
      safeText(track.album?.images?.[0]?.url) ||
      "";

    return {
      id: safeText(track.id),
      title: safeText(track.name),
      subtitle: subtitleParts.join(" · "),
      details: detailsParts.join(" · "),
      imageUrl,
      externalUrl: safeText(track.external_urls?.spotify),
      source: "spotify_track" as const,
    };
  });
}

async function searchYouTubeVideos(query: string): Promise<CatalogResult[]> {
  const youtubeApiKey = process.env.YOUTUBE_API_KEY;
  if (!youtubeApiKey) {
    throw new Error("YOUTUBE_API_KEY is missing on server.");
  }

  const endpoint = new URL("https://www.googleapis.com/youtube/v3/search");
  endpoint.searchParams.set("key", youtubeApiKey);
  endpoint.searchParams.set("part", "snippet");
  endpoint.searchParams.set("type", "video");
  endpoint.searchParams.set("maxResults", "8");
  endpoint.searchParams.set("q", query);

  const response = await fetch(endpoint.toString(), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("YouTube search request failed.");
  }

  const payload = (await response.json()) as YouTubeSearchResponse;
  const results: CatalogResult[] = [];

  for (const item of payload.items ?? []) {
    const videoId = safeText(item.id?.videoId);
    if (!videoId) {
      continue;
    }

    const publishedAt = safeText(item.snippet?.publishedAt);
    const publishedYear = publishedAt ? new Date(publishedAt).getFullYear() : NaN;
    const yearLabel = Number.isFinite(publishedYear) ? String(publishedYear) : "";
    const details = ["YouTube video", yearLabel].filter(Boolean).join(" · ");
    const imageUrl =
      safeText(item.snippet?.thumbnails?.medium?.url) ||
      safeText(item.snippet?.thumbnails?.high?.url) ||
      safeText(item.snippet?.thumbnails?.default?.url);

    results.push({
      id: videoId,
      title: safeText(item.snippet?.title),
      subtitle: safeText(item.snippet?.channelTitle),
      details,
      imageUrl,
      externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
      source: "youtube_video",
    });
  }

  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = safeText(searchParams.get("q"));
  const category = searchParams.get("category");

  if (!isCatalogCategory(category)) {
    return NextResponse.json({ error: "Unsupported category." }, { status: 400 });
  }

  if (query.length < 2) {
    return NextResponse.json({ error: "Type at least 2 characters." }, { status: 400 });
  }

  try {
    let results: CatalogResult[] = [];

    if (category === "movies") {
      results = await searchOmdb(query, "movie");
    } else if (category === "tvShows") {
      results = await searchOmdb(query, "series");
    } else if (category === "songs") {
      results = await searchSpotifyTracks(query);
    } else if (category === "youtubeVideos") {
      results = await searchYouTubeVideos(query);
    }

    return NextResponse.json({ results });
  } catch (error) {
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Search is not available right now.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
