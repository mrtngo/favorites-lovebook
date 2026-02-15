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

type Couple = {
  id: string;
  name: string;
  inviteCode: string;
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

type CoupleNotesRow = {
  notes: string | null;
};

type CoupleRow = {
  id: string;
  name: string;
  invite_code: string;
};

type CoupleMembershipRow = {
  couple_id: string;
  couples: CoupleRow | CoupleRow[] | null;
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

function starterDateRows(userId: string, coupleId: string) {
  const year = new Date().getFullYear();

  return [
    {
      user_id: userId,
      couple_id: coupleId,
      name: "Valentine's Day",
      event_date: `${year}-02-14`,
      recurring: true,
      note: "",
    },
    {
      user_id: userId,
      couple_id: coupleId,
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

function normalizeCouple(membership: CoupleMembershipRow | null): Couple | null {
  if (!membership || !membership.couples) {
    return null;
  }

  const raw = Array.isArray(membership.couples)
    ? membership.couples[0]
    : membership.couples;

  if (!raw) {
    return null;
  }

  return {
    id: raw.id,
    name: raw.name,
    inviteCode: raw.invite_code,
  };
}

function parseSupabaseError(error: unknown, fallback: string) {
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "").trim();
    if (message) {
      return message;
    }
  }

  return fallback;
}

function isNoRowsError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? String((error as { code?: unknown }).code ?? "") : "";
  const details =
    "details" in error ? String((error as { details?: unknown }).details ?? "") : "";

  return code === "PGRST116" || details.toLowerCase().includes("0 rows");
}

export default function Home() {
  const [isBooting, setIsBooting] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);

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

  const [pairName, setPairName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [pairMessage, setPairMessage] = useState("");

  const currentCategoryEntries = favorites[activeCategory];

  const loadCoupleData = useCallback(async (coupleId: string) => {
    if (!supabase) {
      return;
    }

    setDataBusy(true);
    setDataMessage("");

    const [datesRes, favoritesRes, notesRes] = await Promise.all([
      supabase
        .from("important_dates")
        .select("id,name,event_date,recurring,note")
        .eq("couple_id", coupleId),
      supabase
        .from("favorite_items")
        .select("id,category,name,details")
        .eq("couple_id", coupleId),
      supabase
        .from("couple_notes")
        .select("notes")
        .eq("couple_id", coupleId)
        .maybeSingle<CoupleNotesRow>(),
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

  const loadCoupleForUser = useCallback(
    async (userId: string) => {
      if (!supabase) {
        return;
      }

      const membershipRes = await supabase
        .from("couple_members")
        .select("couple_id,couples!inner(id,name,invite_code)")
        .eq("user_id", userId)
        .maybeSingle<CoupleMembershipRow>();

      if (membershipRes.error && !isNoRowsError(membershipRes.error)) {
        setPairMessage(parseSupabaseError(membershipRes.error, "Could not load couple."));
        setCouple(null);
        setImportantDates([]);
        setFavorites(emptyFavorites());
        setNotes("");
        return;
      }

      const normalizedCouple = normalizeCouple(membershipRes.data ?? null);
      setCouple(normalizedCouple);

      if (!normalizedCouple) {
        setImportantDates([]);
        setFavorites(emptyFavorites());
        setNotes("");
        return;
      }

      await loadCoupleData(normalizedCouple.id);
    },
    [loadCoupleData],
  );

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
        await loadCoupleForUser(currentSession.user.id);
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
      setPairMessage("");

      if (nextSession?.user) {
        void loadCoupleForUser(nextSession.user.id);
        return;
      }

      setCouple(null);
      setImportantDates([]);
      setFavorites(emptyFavorites());
      setNotes("");
      setDataBusy(false);
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [loadCoupleForUser]);

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
    setPairMessage("");
    await supabase.auth.signOut();
  };

  const createPair = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !session?.user) {
      return;
    }

    const trimmedName = pairName.trim();
    if (!trimmedName) {
      setPairMessage("Give your shared dashboard a name.");
      return;
    }

    setPairBusy(true);
    setPairMessage("");

    const createdRes = await supabase
      .from("couples")
      .insert({
        name: trimmedName,
        created_by: session.user.id,
      })
      .select("id,name,invite_code")
      .single<CoupleRow>();

    if (createdRes.error) {
      setPairMessage(parseSupabaseError(createdRes.error, "Could not create couple."));
      setPairBusy(false);
      return;
    }

    const joinRes = await supabase.from("couple_members").insert({
      couple_id: createdRes.data.id,
      user_id: session.user.id,
    });

    if (joinRes.error) {
      setPairMessage(parseSupabaseError(joinRes.error, "Could not join couple."));
      setPairBusy(false);
      return;
    }

    const seededRes = await supabase
      .from("important_dates")
      .insert(starterDateRows(session.user.id, createdRes.data.id))
      .select("id,name,event_date,recurring,note");

    if (seededRes.error) {
      setPairMessage(parseSupabaseError(seededRes.error, "Created, but failed to seed dates."));
    }

    const freshCouple: Couple = {
      id: createdRes.data.id,
      name: createdRes.data.name,
      inviteCode: createdRes.data.invite_code,
    };

    setCouple(freshCouple);
    setImportantDates((seededRes.data ?? []).map((row) => mapDateRow(row as ImportantDateRow)));
    setFavorites(emptyFavorites());
    setNotes("");
    setPairName("");
    setJoinCode("");
    setPairMessage(`Couple created. Share this code: ${freshCouple.inviteCode}`);
    setPairBusy(false);
  };

  const joinPair = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !session?.user) {
      return;
    }

    const code = joinCode.trim().toUpperCase();
    if (!code) {
      setPairMessage("Enter the invite code.");
      return;
    }

    setPairBusy(true);
    setPairMessage("");

    const coupleRes = await supabase
      .from("couples")
      .select("id,name,invite_code")
      .eq("invite_code", code)
      .single<CoupleRow>();

    if (coupleRes.error) {
      setPairMessage(parseSupabaseError(coupleRes.error, "Invite code not found."));
      setPairBusy(false);
      return;
    }

    const joinRes = await supabase.from("couple_members").insert({
      couple_id: coupleRes.data.id,
      user_id: session.user.id,
    });

    if (joinRes.error) {
      setPairMessage(parseSupabaseError(joinRes.error, "Could not join couple."));
      setPairBusy(false);
      return;
    }

    const linkedCouple: Couple = {
      id: coupleRes.data.id,
      name: coupleRes.data.name,
      inviteCode: coupleRes.data.invite_code,
    };

    setCouple(linkedCouple);
    await loadCoupleData(linkedCouple.id);
    setPairName("");
    setJoinCode("");
    setPairMessage(`Joined ${linkedCouple.name}.`);
    setPairBusy(false);
  };

  const copyInviteCode = async () => {
    if (!couple?.inviteCode || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    try {
      await navigator.clipboard.writeText(couple.inviteCode);
      setDataMessage("Invite code copied.");
    } catch {
      setDataMessage("Could not copy invite code.");
    }
  };

  const addDate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !session?.user || !couple) {
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
        couple_id: couple.id,
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
    if (!supabase || !couple) {
      return;
    }

    setDataMessage("");

    const { error } = await supabase
      .from("important_dates")
      .delete()
      .eq("id", id)
      .eq("couple_id", couple.id);

    if (error) {
      setDataMessage(error.message);
      return;
    }

    setImportantDates((current) => current.filter((entry) => entry.id !== id));
  };

  const addFavorite = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!supabase || !session?.user || !couple) {
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
        couple_id: couple.id,
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
    if (!supabase || !couple) {
      return;
    }

    setDataMessage("");

    const { error } = await supabase
      .from("favorite_items")
      .delete()
      .eq("id", id)
      .eq("couple_id", couple.id);

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
    if (!supabase || !couple) {
      return;
    }

    setDataMessage("");

    const { error } = await supabase.from("couple_notes").upsert(
      {
        couple_id: couple.id,
        notes,
      },
      {
        onConflict: "couple_id",
      },
    );

    if (error) {
      setDataMessage(error.message);
      return;
    }

    setDataMessage("Notes saved.");
  };

  const resetToTemplate = async () => {
    if (!supabase || !session?.user || !couple) {
      return;
    }

    setDataBusy(true);
    setDataMessage("");

    const [delDates, delFavorites, delNotes] = await Promise.all([
      supabase.from("important_dates").delete().eq("couple_id", couple.id),
      supabase.from("favorite_items").delete().eq("couple_id", couple.id),
      supabase.from("couple_notes").delete().eq("couple_id", couple.id),
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
      .insert(starterDateRows(session.user.id, couple.id))
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
            Vercel environment variables.
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
          <p>Each person signs in. Then both join the same shared couple space.</p>

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

  if (!couple) {
    return (
      <main className="shell">
        <div className="bg-overlay" aria-hidden="true" />

        <section className="panel auth-panel">
          <p className="tag">Pair setup</p>
          <h1>Create or join your shared space</h1>
          <p>
            One person creates a couple dashboard, then shares the invite code so
            the other person can join.
          </p>

          <div className="pair-grid">
            <form className="form card pair-card" onSubmit={createPair}>
              <h2>Create</h2>
              <label>
                Couple Name
                <input
                  value={pairName}
                  onChange={(event) => setPairName(event.target.value)}
                  placeholder="Us"
                />
              </label>

              <button className="btn" type="submit" disabled={pairBusy}>
                Create shared dashboard
              </button>
            </form>

            <form className="form card pair-card" onSubmit={joinPair}>
              <h2>Join</h2>
              <label>
                Invite Code
                <input
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                  placeholder="AB12CD34"
                />
              </label>

              <button className="btn" type="submit" disabled={pairBusy}>
                Join with code
              </button>
            </form>
          </div>

          <div className="pair-footer">
            <button className="link-btn" type="button" onClick={signOut}>
              Sign out
            </button>
          </div>

          {pairMessage && <p className="message">{pairMessage}</p>}
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
            <p className="status">
              Space: {couple.name} · Code: <strong>{couple.inviteCode}</strong>
            </p>
            <div className="hero-buttons">
              <button className="link-btn" type="button" onClick={copyInviteCode}>
                Copy code
              </button>
              <button className="link-btn" type="button" onClick={signOut}>
                Sign out
              </button>
            </div>
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
          <h2>Shared Notes</h2>
          <p className="help">Anything either of you says once and never wants to repeat.</p>
          <textarea
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Sizes, favorite brands, places to go, flowers she does not like..."
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
