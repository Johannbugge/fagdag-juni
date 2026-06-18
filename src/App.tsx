// ============================================================================
// App.tsx — DON'T EDIT THIS FILE (you only edit solution.ts)
//
// Renders the Debug Race dashboard, handles registration, and submits your
// solution for grading. Every one of the six functions in solution.ts shows
// up somewhere in this UI — if a function is buggy, the dashboard surfaces
// the wrong-looking number so you can spot it before you submit.
// ============================================================================

import { useEffect, useState } from "react";
import {
  Ticket,
  AssigneeStat,
  weightedCompletionRate,
  prioritySort,
  estimateSprintDays,
  assigneeStats,
  unblockedReady,
  topNByAssignee,
} from "./solution";

const API = import.meta.env.VITE_API_URL as string;

type Filter = "all" | "open" | "done";
type TaskResult = { task: string; pass: boolean };
type GradeResult = {
  score: number;
  total: number;
  passed: boolean;
  duration_ms: number | null;
  details: TaskResult[];
};

const PRIORITY_LABEL: Record<number, string> = {
  1: "low",
  2: "med",
  3: "high",
};

// Task name -> { what it powers in the UI, brief reminder }. Used by the
// task tracker panel so contestants always have a one-line refresher
// without flipping back to solution.ts.
const TASK_GUIDE: { key: string; powers: string; hint: string }[] = [
  {
    key: "weightedCompletionRate",
    powers: "the progress bar % at the top",
    hint: "points-weighted, not ticket-count-weighted",
  },
  {
    key: "prioritySort",
    powers: "the order of the ticket list",
    hint: "priority desc → points desc → id asc",
  },
  {
    key: "estimateSprintDays",
    powers: "the ‘~N days’ estimate",
    hint: "open points only, round up",
  },
  {
    key: "assigneeStats",
    powers: "the workload chips per person",
    hint: "points is OPEN-only — closed tickets don't count",
  },
  {
    key: "unblockedReady",
    powers: "the ‘Ready to start’ panel",
    hint: "every blocker must be done; missing entry = unblocked",
  },
  {
    key: "topNByAssignee",
    powers: "the ‘Top picks per assignee’ grid",
    hint: "open only, sorted by points desc, capped at N",
  },
];

function fmt(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

// Defensive runner — a buggy solution shouldn't blow up the whole dashboard.
function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

export default function App() {
  const [pid, setPid] = useState<string | null>(() =>
    localStorage.getItem("pid"),
  );
  const [name, setName] = useState("");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [blockers, setBlockers] = useState<Record<string, string[]>>({});
  const [velocity, setVelocity] = useState<number>(0);
  const [topN, setTopN] = useState<number>(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [now, setNow] = useState(Date.now());

  const [result, setResult] = useState<GradeResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Live ticking clock.
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch the challenge dataset once we have a participant id.
  useEffect(() => {
    if (!pid) return;
    (async () => {
      try {
        const res = await fetch(`${API}/challenge?participant_id=${pid}`);
        if (!res.ok) throw new Error(`challenge failed (${res.status})`);
        const data = await res.json();
        setTickets(data.tickets);
        setBlockers(data.blockers ?? {});
        setVelocity(data.velocity ?? 0);
        setTopN(data.topN ?? 0);
        setStartedAt(new Date(data.started_at));
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [pid]);

  async function register() {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${API}/participants`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ display_name: name.trim() }),
      });
      if (!res.ok) throw new Error(`registration failed (${res.status})`);
      const { id } = await res.json();
      localStorage.setItem("pid", id);
      setPid(id);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!pid || tickets.length === 0) return;
    setBusy(true);
    setErr(null);
    try {
      // Run YOUR functions over the dataset. Each output is wrapped so a
      // throwing function fails just that task instead of crashing submit.
      const outputs: Record<string, unknown> = {};
      const run = (key: string, fn: () => unknown) => {
        try {
          outputs[key] = fn();
        } catch {
          outputs[key] = null;
        }
      };
      run("weightedCompletionRate", () =>
        weightedCompletionRate([...tickets]),
      );
      run("prioritySort", () =>
        prioritySort([...tickets]).map((t) => t.id),
      );
      run("estimateSprintDays", () =>
        estimateSprintDays([...tickets], velocity),
      );
      run("assigneeStats", () => assigneeStats([...tickets]));
      run("unblockedReady", () =>
        unblockedReady([...tickets], blockers),
      );
      run("topNByAssignee", () => {
        const groups = topNByAssignee([...tickets], topN);
        return Object.fromEntries(
          Object.entries(groups).map(([k, v]) => [
            k,
            (v ?? []).map((t) => t.id),
          ]),
        );
      });

      const res = await fetch(`${API}/submit`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ participant_id: pid, outputs }),
      });
      if (!res.ok) throw new Error(`submit failed (${res.status})`);
      setResult(await res.json());
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    localStorage.removeItem("pid");
    location.reload();
  }

  // --- Registration screen -------------------------------------------------
  if (!pid) {
    return (
      <div className="wrap">
        <style>{CSS}</style>
        <div className="card">
          <div className="badge">Fagdag Juni</div>
          <h1>Debug Race</h1>
          <p className="sub">
            You've inherited a Sprint Board dashboard. Every number on
            screen — the progress bar, the workload chips, the
            ready-to-start panel, the top-picks grid — is computed by one
            of six pure functions in <code>src/solution.ts</code>.
            <br />
            <br />
            All six are subtly broken. Wrong-looking output on the
            dashboard is your hint about which one to chase. Fix them all,
            submit, watch your name climb the leaderboard.
          </p>
          <ul className="hint-list">
            <li>You only edit <code>src/solution.ts</code>.</li>
            <li>Read the JSDoc on each function — the corner cases bite.</li>
            <li>Submit as often as you want — the response tells you which tasks pass.</li>
          </ul>
          <label>Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ada"
            onKeyDown={(e) => e.key === "Enter" && register()}
          />
          <button onClick={register} disabled={busy || !name.trim()}>
            {busy ? "Starting…" : "Start the clock →"}
          </button>
          {err && <p className="err">{err}</p>}
        </div>
      </div>
    );
  }

  // --- Dashboard -----------------------------------------------------------
  // Reference counts/sums — these are NOT computed via the buggy functions,
  // so the dashboard always has a ground truth to render alongside the
  // participant's (possibly wrong) numbers. That side-by-side is what makes
  // a bug visible.
  const totalTickets = tickets.length;
  const doneTickets = tickets.filter((t) => t.done).length;
  const totalPts = tickets.reduce((s, t) => s + t.points, 0);
  const donePts = tickets
    .filter((t) => t.done)
    .reduce((s, t) => s + t.points, 0);
  const openPts = totalPts - donePts;

  // Buggy-function outputs. Wrapped in `safe` so a throw renders a sensible
  // fallback rather than a white screen — bugs should be observable, not
  // catastrophic.
  const rate = safe(() => weightedCompletionRate([...tickets]), 0);
  const days = safe(() => estimateSprintDays([...tickets], velocity), 0);
  const stats = safe<Record<string, AssigneeStat>>(
    () => assigneeStats([...tickets]),
    {},
  );
  const ready = safe<string[]>(
    () => unblockedReady([...tickets], blockers),
    [],
  );
  const top = safe<Record<string, Ticket[]>>(
    () => topNByAssignee([...tickets], topN),
    {},
  );

  // Filter inline (filtering isn't one of the six tasks), then sort with the
  // participant's prioritySort. Pass a copy so a mutating sort can't corrupt
  // our `tickets` state.
  const filtered =
    filter === "all"
      ? tickets
      : filter === "open"
        ? tickets.filter((t) => !t.done)
        : tickets.filter((t) => t.done);
  const visible = safe(() => prioritySort([...filtered]), filtered);

  const elapsed = startedAt ? now - startedAt.getTime() : 0;
  const ticketById = new Map(tickets.map((t) => [t.id, t]));

  // Map of task name -> pass/fail from the latest submission, for the
  // status pips on the task tracker.
  const taskStatus = new Map<string, boolean>(
    result?.details.map((d) => [d.task, d.pass]) ?? [],
  );

  // Loading state — between registering and the challenge fetch landing.
  // Empty-dataset rendering is technically safe (everything degrades to
  // 0/empty), but it briefly shows NaN%/0-day values which look broken.
  if (tickets.length === 0) {
    return (
      <div className="wrap">
        <style>{CSS}</style>
        <div className="board">
          <header>
            <div>
              <h1>Fagdag Juni — Debug Race</h1>
              <p className="sub">Loading your challenge…</p>
            </div>
            <div className="meta">
              <button className="link" onClick={reset}>
                not you?
              </button>
            </div>
          </header>
          <div className="loading-ghost" />
          <div className="loading-ghost" />
          <div className="loading-ghost" />
          {err && <p className="err">{err}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="wrap">
      <style>{CSS}</style>
      <div className="board">
        <header>
          <div>
            <div className="badge inline">Fagdag Juni · Debug Race</div>
            <h1>Sprint Board</h1>
            <p className="sub">
              Fix the six functions in <code>src/solution.ts</code>. Every
              wrong number you see below is a hint about which one is
              still broken.
            </p>
          </div>
          <div className="meta">
            <div className="score-pill">
              {result ? `${result.score} / ${result.total}` : "0 / 6"}
            </div>
            <span className="timer">{fmt(elapsed)}</span>
            <button className="link" onClick={reset}>
              not you?
            </button>
          </div>
        </header>

        {/* Task tracker — six cards, one per function ----------------- */}
        <section className="tasks">
          {TASK_GUIDE.map((t) => {
            const status = taskStatus.get(t.key);
            const cls =
              status === true ? "pass" : status === false ? "fail" : "todo";
            const icon = status === true ? "✓" : status === false ? "✗" : "•";
            return (
              <div className={`task ${cls}`} key={t.key}>
                <div className="task-head">
                  <span className="task-icon">{icon}</span>
                  <code>{t.key}</code>
                </div>
                <div className="task-powers">powers {t.powers}</div>
                <div className="task-hint">{t.hint}</div>
              </div>
            );
          })}
        </section>

        {/* Progress + headline stats ------------------------------------ */}
        <div className="bar">
          <div
            className="fill"
            style={{
              width: `${Math.min(100, Math.max(0, Number(rate) || 0))}%`,
            }}
          />
        </div>
        <div className="stats">
          <span>
            <b>{String(rate)}%</b> done
          </span>
          <span className="muted">
            ({doneTickets}/{totalTickets} tickets · {donePts}/{totalPts} pts)
          </span>
          <span>
            velocity <b>{velocity}</b>/day
          </span>
          <span>
            estimate <b>~{String(days)}</b> days
          </span>
          <span className="muted">({openPts} open pts)</span>
        </div>

        {/* Workload by assignee ---------------------------------------- */}
        <section className="panel">
          <h2>Workload</h2>
          <div className="chips">
            {Object.entries(stats).map(([who, s]) => (
              <span className="chip" key={who}>
                <b>{who}</b> · {String(s?.open ?? "?")} open ·{" "}
                {String(s?.points ?? "?")} pts ·{" "}
                <span className="muted">{String(s?.done ?? "?")} done</span>
              </span>
            ))}
            {Object.keys(stats).length === 0 && (
              <span className="muted">no data</span>
            )}
          </div>
        </section>

        {/* Filters ----------------------------------------------------- */}
        <div className="filters">
          {(["all", "open", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              className={filter === f ? "active" : ""}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Ticket list (sorted via prioritySort) ----------------------- */}
        <ul className="list">
          {visible.map((t) => {
            const blocks = blockers[t.id] ?? [];
            return (
              <li key={t.id}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() =>
                    setTickets((cur) =>
                      cur.map((x) =>
                        x.id === t.id ? { ...x, done: !x.done } : x,
                      ),
                    )
                  }
                />
                <span className="tid">{t.id}</span>
                <span className={`title ${t.done ? "is-done" : ""}`}>
                  {t.title}
                </span>
                <span className={`pri p${t.priority}`}>
                  {PRIORITY_LABEL[t.priority] ?? t.priority}
                </span>
                <span className="pts">{t.points} pts</span>
                <span className="who">{t.assignee}</span>
                {blocks.length > 0 && (
                  <span className="blocked">
                    blocked by {blocks.join(", ")}
                  </span>
                )}
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="empty">no tickets in this view</li>
          )}
        </ul>

        {/* Ready to start ---------------------------------------------- */}
        <section className="panel">
          <h2>Ready to start</h2>
          <p className="panel-sub">
            Open tickets whose blockers are all done.
          </p>
          {ready.length === 0 ? (
            <p className="muted">nothing ready</p>
          ) : (
            <ul className="ready">
              {ready.map((id) => {
                const t = ticketById.get(id);
                return (
                  <li key={id}>
                    <span className="tid">{id}</span>
                    <span>{t?.title ?? "(unknown)"}</span>
                    {t && (
                      <span className={`pri p${t.priority}`}>
                        {PRIORITY_LABEL[t.priority] ?? t.priority}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Top picks per assignee -------------------------------------- */}
        <section className="panel">
          <h2>Top {topN} picks per assignee</h2>
          <p className="panel-sub">
            Each person's heaviest open tickets — biggest impact first.
          </p>
          <div className="top-grid">
            {Object.entries(top).map(([who, list]) => (
              <div className="top-col" key={who}>
                <h3>{who}</h3>
                {(!list || list.length === 0) && (
                  <p className="muted">nothing open</p>
                )}
                <ul>
                  {(list ?? []).map((t) => (
                    <li key={t.id}>
                      <span className="tid">{t.id}</span>
                      <span className="pts">{t.points} pts</span>
                      <span className="title-sm">{t.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {Object.keys(top).length === 0 && (
              <span className="muted">no data</span>
            )}
          </div>
        </section>

        <footer>
          <button
            className="primary"
            onClick={submit}
            disabled={busy || tickets.length === 0}
          >
            {busy ? "Grading…" : "Submit & grade"}
          </button>
          {err && <span className="err">{err}</span>}
        </footer>

        {result && (
          <div className={`result ${result.passed ? "ok" : ""}`}>
            <strong>
              {result.score} / {result.total} passing
              {result.passed &&
                result.duration_ms != null &&
                ` — finished in ${fmt(result.duration_ms)} 🎉`}
            </strong>
            <ul>
              {result.details.map((d) => (
                <li key={d.task}>
                  <span>{d.pass ? "✓" : "✗"}</span> {d.task}
                </li>
              ))}
            </ul>
            {!result.passed && (
              <p className="hint">
                Fix what's failing and submit again — resubmit as many times
                as you like.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .wrap {
    min-height: 100vh;
    background: #f5f5f7;
    color: #1d1d22;
    font: 15px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif;
    display: flex;
    justify-content: center;
    padding: 32px 16px;
  }
  code { background: #ececf1; padding: 1px 5px; border-radius: 5px; font-size: 0.9em; }
  h1 { font-size: 22px; margin: 0; letter-spacing: -0.02em; }
  h2 { font-size: 13px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: #6b6b76; margin: 0 0 4px; }
  h3 { font-size: 13px; font-weight: 700; margin: 0 0 6px; color: #1d1d22; }
  .sub { color: #6b6b76; margin: 4px 0 0; font-size: 13px; }
  .panel-sub { color: #6b6b76; margin: 0 0 12px; font-size: 12px; }
  .err { color: #c0344d; font-size: 13px; margin-left: 8px; }
  .muted { color: #9a9aa4; }

  .card {
    background: #fff; border: 1px solid #e6e6ec; border-radius: 16px;
    padding: 32px; width: 100%; max-width: 520px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }
  .card h1 { font-size: 32px; letter-spacing: -0.03em; margin: 8px 0 12px; }
  .card .sub { font-size: 14px; line-height: 1.55; color: #4a4a55; margin: 0 0 18px; }
  .card label { display: block; font-size: 12px; font-weight: 600; color: #6b6b76; margin: 18px 0 6px; }
  .card input {
    width: 100%; padding: 10px 12px; border: 1px solid #d7d7df; border-radius: 9px;
    font-size: 15px; outline: none;
  }
  .card input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79,70,229,.15); }
  .card button {
    margin-top: 22px; width: 100%; padding: 11px; border: none; border-radius: 9px;
    background: #4f46e5; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .card button:disabled { opacity: .5; cursor: default; }

  .badge {
    display: inline-block; font: 700 11px/1 ui-monospace, monospace;
    letter-spacing: .14em; text-transform: uppercase; color: #4f46e5;
    background: #eef2ff; border-radius: 99px; padding: 6px 12px;
  }
  .badge.inline { margin-bottom: 6px; }

  .hint-list {
    list-style: none; margin: 0 0 6px; padding: 0;
    display: flex; flex-direction: column; gap: 8px;
    background: #fafafd; border: 1px solid #ececf1; border-radius: 12px;
    padding: 14px 16px;
  }
  .hint-list li { font-size: 13px; color: #4a4a55; padding-left: 18px; position: relative; }
  .hint-list li::before {
    content: "→"; position: absolute; left: 0; top: 0; color: #4f46e5; font-weight: 700;
  }

  .score-pill {
    font: 700 13px/1 ui-monospace, monospace; letter-spacing: .08em;
    background: #fafafd; border: 1px solid #ececf1; border-radius: 99px;
    padding: 6px 12px; color: #4a4a55;
  }

  .tasks {
    margin-top: 22px;
    display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px;
  }
  .task {
    border: 1px solid #ececf1; border-radius: 10px; padding: 12px 14px;
    background: #fafafd; transition: background .25s, border-color .25s;
  }
  .task.pass { background: #eefaf1; border-color: #c8ebd2; }
  .task.fail { background: #fbf3f4; border-color: #f3d9de; }
  .task-head { display: flex; align-items: center; gap: 8px; }
  .task-head code { background: transparent; padding: 0; font-size: 13px; font-weight: 600; color: #1d1d22; }
  .task-icon {
    width: 20px; height: 20px; border-radius: 99px; display: inline-flex;
    align-items: center; justify-content: center; font-size: 12px; font-weight: 700;
    background: #ececf1; color: #6b6b76;
  }
  .task.pass .task-icon { background: #34d399; color: #fff; }
  .task.fail .task-icon { background: #c0344d; color: #fff; }
  .task-powers { margin-top: 6px; font-size: 12px; color: #6b6b76; }
  .task-hint { margin-top: 4px; font-size: 11px; color: #9a9aa4; font-style: italic; }

  .loading-ghost {
    height: 64px; margin-top: 14px; border-radius: 12px;
    background: linear-gradient(90deg, #f0f0f3, #f7f7fa, #f0f0f3);
    background-size: 200% 100%; animation: sweep 1.4s linear infinite;
  }
  @keyframes sweep { from { background-position: 200% 0; } to { background-position: -200% 0; } }

  .board {
    background: #fff; border: 1px solid #e6e6ec; border-radius: 16px;
    padding: 24px; width: 100%; max-width: 820px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; }
  .meta { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
  .timer { font: 600 20px ui-monospace, "SF Mono", Menlo, monospace; font-variant-numeric: tabular-nums; }
  .link { background: none; border: none; color: #9a9aa4; font-size: 12px; cursor: pointer; text-decoration: underline; padding: 0; }

  .bar { height: 8px; background: #ececf1; border-radius: 99px; overflow: hidden; margin: 18px 0 8px; }
  .fill { height: 100%; background: #4f46e5; border-radius: 99px; transition: width .3s ease; }
  .stats { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; font-size: 13px; color: #4a4a55; }
  .stats b { color: #1d1d22; }

  .panel { margin-top: 22px; padding: 16px; border: 1px solid #ececf1; border-radius: 12px; background: #fafafd; }
  .chips { display: flex; gap: 8px; flex-wrap: wrap; }
  .chip { background: #fff; border: 1px solid #e6e6ec; border-radius: 99px; padding: 5px 12px; font-size: 13px; color: #4a4a55; }
  .chip b { color: #1d1d22; }

  .filters { display: flex; gap: 6px; margin: 22px 0 12px; }
  .filters button {
    border: 1px solid #e0e0e8; background: #fff; border-radius: 8px;
    padding: 5px 14px; font-size: 13px; text-transform: capitalize; cursor: pointer; color: #4a4a55;
  }
  .filters button.active { background: #1d1d22; color: #fff; border-color: #1d1d22; }

  .list { list-style: none; margin: 0; padding: 0; }
  .list li {
    display: grid; grid-template-columns: auto 56px 1fr auto auto auto; gap: 12px; align-items: center;
    padding: 11px 4px; border-top: 1px solid #f0f0f3; font-size: 14px;
  }
  .list li.empty { display: block; text-align: center; color: #9a9aa4; padding: 18px; }
  .list input { width: 16px; height: 16px; accent-color: #4f46e5; }
  .tid { font: 12px ui-monospace, Menlo, monospace; color: #9a9aa4; }
  .title.is-done { text-decoration: line-through; color: #adadb8; }
  .pri { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 2px 8px; border-radius: 99px; letter-spacing: .03em; }
  .p1 { background: #eef2ff; color: #4f46e5; }
  .p2 { background: #fff3e0; color: #b9620a; }
  .p3 { background: #fde8ec; color: #c0344d; }
  .pts { font-size: 12px; color: #6b6b76; }
  .who { font-size: 12px; color: #4a4a55; }
  .blocked {
    grid-column: 2 / -1; margin-top: 2px;
    font-size: 11px; color: #b9620a; background: #fff7eb;
    border: 1px solid #f5e3c4; border-radius: 6px;
    padding: 2px 8px; justify-self: start;
  }

  .ready { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .ready li { display: grid; grid-template-columns: 56px 1fr auto; gap: 10px; align-items: center; font-size: 13px; padding: 4px 8px; background: #fff; border: 1px solid #ececf1; border-radius: 8px; }

  .top-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; }
  .top-col { background: #fff; border: 1px solid #ececf1; border-radius: 10px; padding: 12px; }
  .top-col ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
  .top-col li { display: grid; grid-template-columns: 50px auto 1fr; gap: 6px; align-items: baseline; font-size: 12px; }
  .title-sm { color: #4a4a55; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  footer { display: flex; align-items: center; margin-top: 22px; }
  .primary {
    border: none; border-radius: 9px; background: #4f46e5; color: #fff;
    padding: 11px 22px; font-size: 15px; font-weight: 600; cursor: pointer;
  }
  .primary:disabled { opacity: .5; cursor: default; }

  .result { margin-top: 22px; padding: 16px; border-radius: 12px; background: #fbf3f4; border: 1px solid #f3d9de; }
  .result.ok { background: #eefaf1; border-color: #c8ebd2; }
  .result strong { font-size: 15px; }
  .result ul { list-style: none; margin: 12px 0 0; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font: 13px ui-monospace, Menlo, monospace; }
  .result li span { font-weight: 700; }
  .hint { font-size: 13px; color: #6b6b76; margin: 12px 0 0; }
`;
