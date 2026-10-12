import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, Entry, Snapshot, Status, Totals } from "./api";
import { addDays, DateFormat, DurationFormat, localDay } from "./format";
import { liveTotals as foldLive } from "./live";
import { TimerPanel } from "./components/TimerPanel";
import { TotalsStrip } from "./components/TotalsStrip";
import { AddTimeForm } from "./components/AddTimeForm";
import { DayList } from "./components/DayList";
import { SettingsPage } from "./components/SettingsPage";
import { StartupNotices } from "./components/StartupNotices";

const PAGE_DAYS = 30;

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [status, setStatus] = useState<Status>({ running: null, elapsedSeconds: 0 });
  const [entries, setEntries] = useState<Entry[]>([]);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [fetchedAt, setFetchedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  const [filter, setFilter] = useState<number | null>(null);
  const [days, setDays] = useState(PAGE_DAYS);
  const [error, setError] = useState<string | null>(null);
  // Failed user actions; kept apart from `error` so a later refresh can't clear them.
  const [actionError, setActionError] = useState<string | null>(null);
  const [view, setView] = useState<"main" | "settings">("main");
  // Lives here so dismissals survive a trip to Settings.
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());

  const today = localDay(new Date(now));

  // Only the newest refresh may write state; older responses can land later.
  const latestRefresh = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++latestRefresh.current;
    try {
      const t = localDay();
      const [s, e, tot] = await Promise.all([
        api.snapshot(),
        api.entries(addDays(t, -(days - 1)), t, filter),
        api.totals(filter),
      ]);
      if (request !== latestRefresh.current) return;
      setSnap(s);
      setStatus(s.status);
      setEntries(e);
      setTotals(tot);
      setFetchedAt(Date.now());
      setError(null);
    } catch (err) {
      if (request === latestRefresh.current) setError(String(err));
    }
  }, [days, filter]);
  const reportError = useCallback((err: unknown) => setActionError(String(err)), []);

  useEffect(() => {
    // refresh() sets state only after awaiting, never synchronously.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unlisten = api.onTimerChanged(() => void refresh());
    return () => {
      void unlisten.then((fn) => fn());
    };
  }, [refresh]);

  // Errors outside render (handlers, timers, stray promises) go to the banner too.
  useEffect(() => {
    const onError = (e: ErrorEvent) => reportError(e.error ?? e.message);
    const onRejection = (e: PromiseRejectionEvent) => reportError(e.reason);
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, [reportError]);

  // Live clock. Also re-fetch when the window regains focus or the day rolls over.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [refresh]);
  const seenToday = useRef(today);
  useEffect(() => {
    if (seenToday.current === today) return;
    seenToday.current = today;
    void refresh();
  }, [today, refresh]);

  const running = status.running;
  const liveSeconds = running
    ? running.priorSeconds + Math.max(0, (now - Date.parse(running.intervalStartedAt)) / 1000)
    : 0;
  // Seconds the running timer has added since the last fetch; folded into totals and the list.
  const sinceFetch = running ? Math.max(0, (now - fetchedAt) / 1000) : 0;
  const liveCountsForFilter = running != null && (filter == null || filter === running.projectId);
  const runningDay = entries.find((e) => e.running)?.day;

  const liveEntries = useMemo(
    () => entries.map((e) => (e.running ? { ...e, seconds: e.seconds + sinceFetch } : e)),
    [entries, sinceFetch],
  );
  const liveTotals = useMemo(() => {
    if (!totals || !liveCountsForFilter || runningDay == null) return totals;
    return foldLive(totals, sinceFetch, runningDay, today);
  }, [totals, liveCountsForFilter, sinceFetch, runningDay, today]);

  if (!snap) {
    return <div className="loading">{error ?? "Loading…"}</div>;
  }

  const durationFormat = (snap.settings.duration_format as DurationFormat) ?? "hms";
  const dateFormat = (snap.settings.date_format as DateFormat) ?? "iso";
  const saveSetting = async (key: string, value: string) => {
    try {
      await api.setSetting(key, value);
    } catch (err) {
      reportError(err);
      return;
    }
    await refresh();
  };
  const errorBanner = (
    <>
      {error && <div className="notice notice--error">{error}</div>}
      {actionError && (
        <div className="notice notice--error">
          <span>{actionError}</span>
          <button className="btn btn--ghost" onClick={() => setActionError(null)}>
            Dismiss
          </button>
        </div>
      )}
    </>
  );

  if (view === "settings") {
    return (
      <div className="app">
        <header className="topbar">
          <h1>Settings</h1>
          <button className="btn btn--ghost" onClick={() => setView("main")}>
            Done
          </button>
        </header>
        {errorBanner}
        <SettingsPage snapshot={snap} onChange={(k, v) => void saveSetting(k, v)} />
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

      {errorBanner}
      <StartupNotices
        startup={snap.startup}
        dismissed={dismissed}
        onDismiss={(k) => setDismissed((d) => new Set(d).add(k))}
      />

      <TimerPanel
        projects={snap.projects}
        lastProjectId={snap.lastProjectId}
        status={status}
        liveSeconds={liveSeconds}
        entries={entries}
        today={today}
        onChanged={() => void refresh()}
        onError={reportError}
      />

      <TotalsStrip
        totals={liveTotals}
        projects={snap.projects}
        filter={filter}
        onFilter={setFilter}
      />

      <AddTimeForm
        projects={snap.projects}
        lastProjectId={snap.lastProjectId}
        today={today}
        onChanged={() => void refresh()}
        onError={reportError}
      />

      <DayList
        entries={liveEntries}
        today={today}
        durationFormat={durationFormat}
        dateFormat={dateFormat}
        onChanged={() => void refresh()}
        onError={reportError}
      />

      <button className="more" onClick={() => setDays((d) => d + PAGE_DAYS)}>
        Show {PAGE_DAYS} more days
      </button>
    </div>
  );
}
