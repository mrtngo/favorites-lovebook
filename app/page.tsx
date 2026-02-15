"use client";

import { type FormEvent, useEffect, useMemo, useState } from "react";

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
};

type ImportantDate = {
  id: string;
  name: string;
  date: string;
  recurring: boolean;
  note: string;
};

type StoredData = {
  importantDates: ImportantDate[];
  favorites: Record<FavoriteCategory, FavoriteEntry[]>;
  notes: string;
};

const STORAGE_KEY = "favorites-lovebook-v1";

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

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function emptyFavorites(): Record<FavoriteCategory, FavoriteEntry[]> {
  return {
    gifts: [],
    destinations: [],
    flowers: [],
    dateIdeas: [],
    littleThings: [],
  };
}

function starterDates(): ImportantDate[] {
  const year = new Date().getFullYear();

  return [
    {
      id: createId(),
      name: "Valentine's Day",
      date: `${year}-02-14`,
      recurring: true,
      note: "",
    },
    {
      id: createId(),
      name: "Christmas",
      date: `${year}-12-25`,
      recurring: true,
      note: "",
    },
  ];
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
  const [isLoaded, setIsLoaded] = useState(false);

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

  useEffect(() => {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    let loadedDates = starterDates();
    let loadedFavorites = emptyFavorites();
    let loadedNotes = "";

    if (raw) {
      try {
        const parsed = JSON.parse(raw) as StoredData;

        if (Array.isArray(parsed.importantDates)) {
          loadedDates = parsed.importantDates;
        }

        if (parsed.favorites) {
          loadedFavorites = { ...emptyFavorites(), ...parsed.favorites };
        }

        if (typeof parsed.notes === "string") {
          loadedNotes = parsed.notes;
        }
      } catch {
        loadedDates = starterDates();
      }
    }

    queueMicrotask(() => {
      setImportantDates(loadedDates);
      setFavorites(loadedFavorites);
      setNotes(loadedNotes);
      setIsLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }

    const payload: StoredData = {
      importantDates,
      favorites,
      notes,
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [importantDates, favorites, notes, isLoaded]);

  const sortedDates = useMemo(() => {
    return [...importantDates].sort((a, b) => {
      return nextOccurrence(a).getTime() - nextOccurrence(b).getTime();
    });
  }, [importantDates]);

  const currentCategoryEntries = favorites[activeCategory];

  const addDate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = dateName.trim();
    if (!name || !dateValue) {
      return;
    }

    const entry: ImportantDate = {
      id: createId(),
      name,
      date: dateValue,
      recurring: dateRecurring,
      note: dateNote.trim(),
    };

    setImportantDates((current) => [entry, ...current]);
    setDateName("");
    setDateValue("");
    setDateRecurring(true);
    setDateNote("");
  };

  const removeDate = (id: string) => {
    setImportantDates((current) => current.filter((entry) => entry.id !== id));
  };

  const addFavorite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = favoriteName.trim();
    if (!name) {
      return;
    }

    const entry: FavoriteEntry = {
      id: createId(),
      name,
      details: favoriteDetails.trim(),
    };

    setFavorites((current) => ({
      ...current,
      [activeCategory]: [entry, ...current[activeCategory]],
    }));

    setFavoriteName("");
    setFavoriteDetails("");
  };

  const removeFavorite = (category: FavoriteCategory, id: string) => {
    setFavorites((current) => ({
      ...current,
      [category]: current[category].filter((entry) => entry.id !== id),
    }));
  };

  const resetToTemplate = () => {
    setImportantDates(starterDates());
    setFavorites(emptyFavorites());
    setNotes("");
  };

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
          <p className="status">Auto-saved on this device.</p>
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

              <button className="btn" type="submit">
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

              <button className="btn" type="submit">
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
        </article>

        <footer className="footer">
          <button className="link-btn" type="button" onClick={resetToTemplate}>
            Reset to starter template
          </button>
          {!isLoaded && <span>Loading saved data...</span>}
        </footer>
      </section>
    </main>
  );
}
