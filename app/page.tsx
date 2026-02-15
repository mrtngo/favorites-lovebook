"use client";

import { createClient, type Session } from "@supabase/supabase-js";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type FavoriteCategory =
  | "gifts"
  | "destinations"
  | "flowers"
  | "dateIdeas"
  | "littleThings";

type FavoriteEntry = {
  id: string;
  name: string;
  details: string;
  category: FavoriteCategory;
};

type ImportantDate = {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
  note: string;
};

type ImportantDateRow = {
  id: string;
  name: string;
  event_date: string;
  recurring: boolean;
  note: string | null;
};

type FavoriteItemRow = {
  id: string;
  category: FavoriteCategory;
  name: string;
  details: string | null;
};

type UserNotesRow = {
  notes: string | null;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

const categoryMeta: Array<{ key: FavoriteCategory; label: string; hint: string }> = [
  {
    key: "gifts",
    label: "Gifts",
    hint: "Perfume, rings, books, clothing...",
  },
  {
    key: "destinations",
    label: "Destinations",
    hint: "Cities, beaches, hotels, weekend escapes...",
  },
  {
    key: "flowers",
    label: "Flowers",
    hint: "Roses, tulips, lilies, peonies...",
  },
  {
    key: "dateIdeas",
    label: "Date Ideas",
    hint: "Dinner plans, concerts, museums, picnics...",
  },
  {
    key: "littleThings",
    label: "Little Things",
    hint: "Snacks, songs, movies, random favorites...",
  },
];

const categoryLabel: Record<FavoriteCategory, string> = {
  gifts: "Gifts",
  destinations: "Destinations",
  flowers: "Flowers",
  dateIdeas: "Date Ideas",
  littleThings: "Little Things",
};

function emptyFavorites(): Record<FavoriteCategory, FavoriteEntry[]> {
  return {
    gifts: [],
    destinations: [],
    flowers: [],
    dateIdeas: [],
    littleThings: [],
  };
}

function starterDateRows(userId: string) {
  const year = new Date().getFullYear();

  return [
    {
      user_id: userId,
      name: "Valentine's Day",
      event_date: `${year}-02-14`,
      recurring: true,
      note: "",
    },
    {
      user_id: userId,
      name: "Christmas",
      event_date: `${year}-12-25`,
      recurring: true,
      note: "",
    },
  ];
}

function mapDateRow(row: ImportantDateRow): ImportantDate {
  return {
    id: row.id,
    name: row.name,
    date: row.event_date,
    recurring: row.recurring,
    note: row.note ?? "",
  };
}

function mapFavoriteRow(row: FavoriteItemRow): FavoriteEntry {
  return {
    id: row.id,
    category: row.category,
    name: row.name,
    details: row.details ?? "",
  };
}

function toNoon(date: Date) {
  const copy = new Date(date);
  copy.setHours(12, 0, 0, 0);
  return copy;
}

function nextOccurrence(entry: ImportantDate) {
  const parsed = new Date(`${entry.date}T12:00:00`);

  if (!entry.recurring || Number.isNaN(parsed.getTime())) {
    return parsed;
  }

  const now = toNoon(new Date());
  const month = parsed.getMonth();
  const day = parsed.getDate();

  let next = new Date(now.getFullYear(), month, day, 12, 0, 0, 0);
  if (next < now) {
    next = new Date(now.getFullYear() + 1, month, day, 12, 0, 0, 0);
  }

  return next;
}

function daysAway(target: Date) {
  const now = toNoon(new Date());
  const future = toNoon(target);
  return Math.round((future.getTime() - now.getTime()) / 86400000);
}

function formatLongDate(date: Date) {
  if (Number.isNaN(date.getTime())) {
    return "Invalid date";
  }

  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function distanceLabel(distance: number) {
  if (distance === 0) {
    return "Today";
  }

  if (distance === 1) {
    return "Tomorrow";
  }

  if (distance > 1) {
    return `In ${distance} days`;
  }

  if (distance === -1) {
    return "Yesterday";
  }

  return `${Math.abs(distance)} days ago`;
}

export default function Home() {
  const [isBooting, setIsBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  const [importantDates, setImportantDates] = useState<ImportantDate[]>([]);
  const [favorites, setFavorites] = useState<Record<FavoriteCategory, FavoriteEntry[]>>(
    emptyFavorites,
  );
  const [notes, setNotes] = useState("");

  const [activeCategory, setActiveCategory] = useState<FavoriteCategory>("gifts");

  const [dateName, setDateName] = useState("");
  const [dateValue, setDateValue] = useState("");
  const [dateRecurring, setDateRecurring] = useState(true);
  const [dateNote, setDateNote] = useState("");

  const [favoriteName, setFavoriteName] = useState("");
  const [favoriteDetails, setFavoriteDetails] = useState("");

  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [authBusy, setAuthBusy] = useState(false);
  const [authMessage, setAuthMessage] = useState("");

  const [dataBusy, setDataBusy] = useState(false);
  const [dataMessage, setDataMessage] = useState("");

  const currentCategoryEntries = favorites[activeCategory];

  const loadUserData = useCallback(async (userId: string) => {
    if (!supabase) {
      return;
    }

    setDataBusy(true);
    setDataMessage("");

    const [datesRes, favoritesRes, notesRes] = await Promise.all([
      supabase
        .from("important_dates")
        .select("id,name,event_date,recurring,note")
        .eq("user_id", userId),
      supabase
        .from("favorite_items")
        .select("id,category,name,details")
        .eq("user_id", userId),
      supabase
        .from("user_notes")
        .select("notes")
        .eq("user_id", userId)
        .maybeSingle<UserNotesRow>(),
    ]);

    if (datesRes.error || favoritesRes.error || notesRes.error) {
      setDataMessage(
        datesRes.error?.message ??
          favoritesRes.error?.message ??
          notesRes.error?.message ??
          "Could not load data.",
      );
      setDataBusy(false);
      return;
    }

    const mappedDates = (datesRes.data ?? []).map((row) =>
      mapDateRow(row as ImportantDateRow),
    );

    const mappedFavorites = emptyFavorites();
    for (const row of favoritesRes.data ?? []) {
      const mapped = mapFavoriteRow(row as FavoriteItemRow);
      mappedFavorites[mapped.category].push(mapped);
    }

    setImportantDates(mappedDates);
    setFavorites(mappedFavorites);
    setNotes(notesRes.data?.notes ?? "");
    setDataBusy(false);
  }, []);

  useEffect(() => {
    if (!supabase) {
      queueMicrotask(() => {
        setIsBooting(false);
      });
      return;
    }

    let cancelled = false;

    const bootstrap = async () => {
      const { data, error } = await supabase.auth.getSession();
      if (cancelled) {
        return;
      }

      if (error) {
        setAuthMessage(error.message);
      }

      const currentSession = data.session;
      setSession(currentSession);

      if (currentSession?.user) {
        await loadUserData(currentSession.user.id);
      }

      setIsBooting(false);
    };

    void bootstrap();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (cancelled) {
        return;
      }

      setSession(nextSession);
      setAuthMessage("");

      if (nextSession?.user) {
        void loadUserData(nextSession.user.id);
        return;
      }

      setImportantDates([]);
      setFavorites(emptyFavorites());
      setNotes("");
      setDataBusy(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadUserData]);

  const sortedDates = useMemo(() => {
    return [...importantDates].sort((a, b) => {
      return nextOccurrence(a).getTime() - nextOccurrence(b).getTime();
    });
  }, [importantDates]);

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase) {
      return;
    }

    const email = authEmail.trim();
    const password = authPassword;

    if (!email || !password) {
      setAuthMessage("Email and password are required.");
      return;
    }

    setAuthBusy(true);
    setAuthMessage("");

    if (authMode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setAuthMessage(error.message);
      }

      setAuthBusy(false);
      return;
    }

    const { data, error } = await supabase.auth.signUp({ email, password });

    if (error) {
      setAuthMessage(error.message);
      setAuthBusy(false);
      return;
    }

    if (!data.session) {
      setAuthMessage("Account created. Check your email, then sign in.");
    } else {
      setAuthMessage("Account created and signed in.");
    }

    setAuthMode("signin");
    setAuthBusy(false);
  };

  const signOut = async () => {
    if (!supabase) {
      return;
    }

    setDataMessage("");
    await supabase.auth.signOut();
  };

  const addDate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !session?.user) {
      return;
    }

    const name = dateName.trim();
    if (!name || !dateValue) {
      return;
    }

    setDataMessage("");

    const { data, error } = await supabase
      .from("important_dates")
      .insert({
        user_id: session.user.id,
        name,
        event_date: dateValue,
        recurring: dateRecurring,
        note: dateNote.trim(),
      })
      .select("id,name,event_date,recurring,note")
      .single<ImportantDateRow>();

    if (error) {
      setDataMessage(error.message);
      return;
    }

    setImportantDates((current) => [mapDateRow(data), ...current]);
    setDateName("");
    setDateValue("");
    setDateRecurring(true);
    setDateNote("");
  };

  const removeDate = async (id: string) => {
    if (!supabase || !session?.user) {
      return;
    }

    setDataMessage("");

    const { error } = await supabase
      .from("important_dates")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      setDataMessage(error.message);
      return;
    }

    setImportantDates((current) => current.filter((entry) => entry.id !== id));
  };

  const addFavorite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !session?.user) {
      return;
    }

    const name = favoriteName.trim();
    if (!name) {
      return;
    }

    setDataMessage("");

    const { data, error } = await supabase
      .from("favorite_items")
      .insert({
        user_id: session.user.id,
        category: activeCategory,
        name,
        details: favoriteDetails.trim(),
      })
      .select("id,category,name,details")
      .single<FavoriteItemRow>();

    if (error) {
      setDataMessage(error.message);
      return;
    }

    const mapped = mapFavoriteRow(data);

    setFavorites((current) => ({
      ...current,
      [mapped.category]: [mapped, ...current[mapped.category]],
    }));

    setFavoriteName("");
    setFavoriteDetails("");
  };

  const removeFavorite = async (category: FavoriteCategory, id: string) => {
    if (!supabase || !session?.user) {
      return;
    }

    setDataMessage("");

    const { error } = await supabase
      .from("favorite_items")
      .delete()
      .eq("id", id)
      .eq("user_id", session.user.id);

    if (error) {
      setDataMessage(error.message);
      return;
    }

    setFavorites((current) => ({
      ...current,
      [category]: current[category].filter((entry) => entry.id !== id),
    }));
  };

  const saveNotes = async () => {
    if (!supabase || !session?.user) {
      return;
    }

    setDataMessage("");

    const { error } = await supabase.from("user_notes").upsert(
      {
        user_id: session.user.id,
        notes,
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      setDataMessage(error.message);
      return;
    }

    setDataMessage("Notes saved.");
  };

  const resetToTemplate = async () => {
    if (!supabase || !session?.user) {
      return;
    }

    setDataBusy(true);
    setDataMessage("");

    const userId = session.user.id;

    const [delDates, delFavorites, delNotes] = await Promise.all([
      supabase.from("important_dates").delete().eq("user_id", userId),
      supabase.from("favorite_items").delete().eq("user_id", userId),
      supabase.from("user_notes").delete().eq("user_id", userId),
    ]);

    if (delDates.error || delFavorites.error || delNotes.error) {
      setDataMessage(
        delDates.error?.message ??
          delFavorites.error?.message ??
          delNotes.error?.message ??
          "Could not reset data.",
      );
      setDataBusy(false);
      return;
    }

    const { data, error } = await supabase
      .from("important_dates")
      .insert(starterDateRows(userId))
      .select("id,name,event_date,recurring,note");

    if (error) {
      setDataMessage(error.message);
      setDataBusy(false);
      return;
    }

    setImportantDates((data ?? []).map((row) => mapDateRow(row as ImportantDateRow)));
    setFavorites(emptyFavorites());
    setNotes("");
    setDataBusy(false);
  };

  if (!supabase) {
    return (
      <main className="shell">
        <section className="panel auth-panel">
          <h1>Supabase env is missing</h1>
          <p>
            Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in
            `.env.local`.
          </p>
        </section>
      </main>
    );
  }

  if (isBooting) {
    return (
      <main className="shell">
        <section className="panel auth-panel">
          <h1>Loading...</h1>
          <p>Checking session and syncing your data.</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="shell">
        <div className="bg-overlay" aria-hidden="true" />

        <section className="panel auth-panel">
          <p className="tag">Private Love Database</p>
          <h1>Sign in</h1>
          <p>Each user gets their own private favorites space.</p>

          <form className="form" onSubmit={handleAuth}>
            <label>
              Email
              <input
                type="email"
                autoComplete="email"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                autoComplete={authMode === "signin" ? "current-password" : "new-password"}
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                placeholder="At least 6 characters"
              />
            </label>

            <div className="auth-actions">
              <button className="btn" type="submit" disabled={authBusy}>
                {authBusy
                  ? "Working..."
                  : authMode === "signin"
                    ? "Sign In"
                    : "Create Account"}
              </button>

              <button
                className="link-btn"
                type="button"
                onClick={() => {
                  setAuthMessage("");
                  setAuthMode((current) =>
                    current === "signin" ? "signup" : "signin",
                  );
                }}
              >
                {authMode === "signin"
                  ? "Need an account? Sign up"
                  : "Already have one? Sign in"}
              </button>
            </div>
          </form>

          {authMessage && <p className="message">{authMessage}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <div className="bg-overlay" aria-hidden="true" />

      <section className="panel">
        <header className="hero">
          <p className="tag">Private Love Database</p>
          <h1>Our Favorites Book</h1>
          <p>
            Keep track of favorite dates, gifts, flowers, destinations, and all
            the tiny details that matter.
          </p>
          <div className="hero-actions">
            <p className="status">Signed in as {session.user.email}</p>
            <button className="link-btn" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </header>

        <div className="grid">
          <article className="card">
            <h2>Important Dates</h2>
            <p className="help">Birthdays, anniversaries, Valentine&apos;s, Christmas, etc.</p>

            <form className="form" onSubmit={addDate}>
              <label>
                Name
                <input
                  value={dateName}
                  onChange={(event) => setDateName(event.target.value)}
                  placeholder="Birthday"
                />
              </label>

              <label>
                Date
                <input
                  type="date"
                  value={dateValue}
                  onChange={(event) => setDateValue(event.target.value)}
                />
              </label>

              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={dateRecurring}
                  onChange={(event) => setDateRecurring(event.target.checked)}
                />
                Repeat every year
              </label>

              <label>
                Note
                <textarea
                  rows={2}
                  value={dateNote}
                  onChange={(event) => setDateNote(event.target.value)}
                  placeholder="Plan, reminder, gift clue..."
                />
              </label>

              <button className="btn" type="submit" disabled={dataBusy}>
                Add Date
              </button>
            </form>

            <ul className="list">
              {sortedDates.length === 0 && <li className="empty">No dates saved yet.</li>}

              {sortedDates.map((entry) => {
                const upcoming = nextOccurrence(entry);
                const distance = daysAway(upcoming);

                return (
                  <li key={entry.id} className="item">
                    <div>
                      <p className="title">{entry.name}</p>
                      <p className="meta">{formatLongDate(upcoming)}</p>
                      <p className="badge">{distanceLabel(distance)}</p>
                      {entry.recurring && <p className="meta">Repeats yearly</p>}
                      {entry.note && <p className="meta">{entry.note}</p>}
                    </div>

                    <button
                      className="link-btn"
                      type="button"
                      onClick={() => removeDate(entry.id)}
                      disabled={dataBusy}
                    >
                      Delete
                    </button>
                  </li>
                );
              })}
            </ul>
          </article>

          <article className="card">
            <h2>Favorites</h2>
            <p className="help">Save exactly what she likes, by category.</p>

            <div className="tabs" role="tablist" aria-label="Favorite categories">
              {categoryMeta.map((category) => (
                <button
                  key={category.key}
                  type="button"
                  className={activeCategory === category.key ? "tab active" : "tab"}
                  onClick={() => setActiveCategory(category.key)}
                >
                  {category.label}
                </button>
              ))}
            </div>

            <form className="form" onSubmit={addFavorite}>
              <label>
                {categoryLabel[activeCategory]}
                <input
                  value={favoriteName}
                  onChange={(event) => setFavoriteName(event.target.value)}
                  placeholder={categoryMeta.find((item) => item.key === activeCategory)?.hint}
                />
              </label>

              <label>
                Details
                <textarea
                  rows={2}
                  value={favoriteDetails}
                  onChange={(event) => setFavoriteDetails(event.target.value)}
                  placeholder="Color, vibe, budget, season, anything useful..."
                />
              </label>

              <button className="btn" type="submit" disabled={dataBusy}>
                Add {categoryLabel[activeCategory]}
              </button>
            </form>

            <ul className="list">
              {currentCategoryEntries.length === 0 && (
                <li className="empty">No {categoryLabel[activeCategory].toLowerCase()} saved yet.</li>
              )}

              {currentCategoryEntries.map((entry) => (
                <li key={entry.id} className="item">
                  <div>
                    <p className="title">{entry.name}</p>
                    {entry.details && <p className="meta">{entry.details}</p>}
                  </div>

                  <button
                    className="link-btn"
                    type="button"
                    onClick={() => removeFavorite(activeCategory, entry.id)}
                    disabled={dataBusy}
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <article className="card full">
          <h2>Personal Notes</h2>
          <p className="help">Anything she says once and you never want to forget.</p>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Sizes, favorite brands, places she wants to go, flowers she does not like..."
          />
          <div className="notes-actions">
            <button className="btn" type="button" onClick={saveNotes} disabled={dataBusy}>
              Save Notes
            </button>
          </div>
        </article>

        <footer className="footer">
          <button
            className="link-btn"
            type="button"
            onClick={resetToTemplate}
            disabled={dataBusy}
          >
            Reset to starter template
          </button>
          {dataBusy && <span>Syncing...</span>}
          {dataMessage && <span>{dataMessage}</span>}
        </footer>
      </section>
    </main>
  );
}
