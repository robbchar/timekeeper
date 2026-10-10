import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Entry, Snapshot, Status, Totals } from "./api";
import { addDays, DateFormat, DurationFormat, localDay } from "./format";
import { TimerPanel } from "./components/TimerPanel";
import { TotalsStrip } from "./components/TotalsStrip";
import { DayList } from "./components/DayList";
import { SettingsPage } from "./components/SettingsPage";
import { StartupNotices } from "./components/StartupNotices";

const PAGE_DAYS = 30;

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>({ running: null, elapsedSeconds: 0 });
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [fetchedAt, setFetchedAt] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState<number | null>(null);
  const [days, setDays] = useState(PAGE_DAYS);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"main" | "settings">("main");

  const today = localDay(new Date(now));

  const refresh = useCallback(async () => {
    try {
      const t = localDay();
      const [s, e, tot] = await Promise.all([
        api.snapshot(),
        api.entries(addDays(t, -(days - 1)), t, filter),
        api.totals(filter),
      ]);
      setSnap(s);
      setStatus(s.status);
      setEntries(e);
      setTotals(tot);
      setFetchedAt(Date.now());
      setError(null);
    } catch (err) {
      setError(String(err));
    }
  }, [days, filter]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = api.onTimerChanged(refresh);
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refresh]);

  // Live clock. Also re-fetch when the window regains focus or the day rolls over.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const running = status.running;
  const liveSeconds = running
    ? running.priorSeconds + Math.max(0, (now - Date.parse(running.intervalStartedAt)) / 1000)
    : 0;
  // Seconds the running timer has added since the last fetch; folded into totals and the list.
  const sinceFetch = running ? Math.max(0, (now - fetchedAt) / 1000) : 0;
  const liveCountsForFilter = running != null && (filter == null || filter === running.projectId);

  const liveEntries = useMemo(
    () => entries.map((e) => (e.running ? { ...e, seconds: e.seconds + sinceFetch } : e)),
    [entries, sinceFetch],
  );
  const liveTotals = useMemo(() => {
    if (!totals || !liveCountsForFilter) return totals;
    const add = sinceFetch;
    return {
      ...totals,
      today: totals.today + add,
      thisWeek: totals.thisWeek + add,
      thisMonth: totals.thisMonth + add,
    };
  }, [totals, liveCountsForFilter, sinceFetch]);

  if (!snap) {
    return <div className="loading">{error ?? "Loading…"}</div>;
  }

  const durationFormat = (snap.settings.duration_format as DurationFormat) ?? "hms";
  const dateFormat = (snap.settings.date_format as DateFormat) ?? "iso";
  const saveSetting = async (key: string, value: string) => {
    await api.setSetting(key, value);
    refresh();
  };

  if (view === "settings") {
    return (
      <div className="app">
        <header className="topbar">
          <h1>Settings</h1>
          <button className="btn btn--ghost" onClick={() => setView("main")}>
            Done
          </button>
        </header>
        <SettingsPage snapshot={snap} onChange={saveSetting} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>TimeKeeper</h1>
        <button className="btn btn--ghost" onClick={() => setView("settings")}>
          Settings
        </button>
      </header>

      {error && <div className="notice notice--error">{error}</div>}
      <StartupNotices startup={snap.startup} />

      <TimerPanel
        projects={snap.projects}
        lastProjectId={snap.lastProjectId}
        status={status}
        liveSeconds={liveSeconds}
        todaysEntries={entries.filter((e) => e.day === today)}
        onChanged={refresh}
      />

      <TotalsStrip
        totals={liveTotals}
        projects={snap.projects}
        filter={filter}
        onFilter={setFilter}
      />

      <DayList
        entries={liveEntries}
        today={today}
        durationFormat={durationFormat}
        dateFormat={dateFormat}
        onChanged={refresh}
      />

      <button className="more" onClick={() => setDays((d) => d + PAGE_DAYS)}>
        Show {PAGE_DAYS} more days
      </button>
    </div>
  );
}
