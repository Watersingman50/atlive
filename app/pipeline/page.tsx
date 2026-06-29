import Link from "next/link";
import type { Metadata } from "next";
import { getPipelineStats } from "@/lib/events";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "ATLive — Pipeline & Data Quality",
  description: "How ATLive ingests, dedupes, and measures Atlanta live-event data.",
};

const REPO = "https://github.com/Watersingman50/atlive";

const fmtAbs = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—";

function rel(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 2) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const DIAGRAM = `GitHub Actions  (cron, every 6h)
      │
      ▼
SourceAdapter[]   Ticketmaster API ─┐
                  529 (HTML scrape) ─┼─▶ pure parsers (eval-tested)
                  Variety (JSON)  ───┘        │
                                              ▼  normalize
                                       CanonicalEvent[]
                                              │
                                              ▼
                                   DEDUP  exact key
                                          → fuzzy fallback
                                          → false-merge guard (tested)
                                              │
                                              ▼
                                claude-haiku-4-5 blurb (generate-once)
                                              │
                                              ▼
                              Supabase  events 1──N event_sources
                                              │  single join, cached via ISR
                                              ▼
                                    Next.js site (Vercel)`;

export default async function Pipeline() {
  const s = await getPipelineStats();
  if (!s) throw new Error("pipeline stats unavailable"); // ISR keeps last-good

  const dupCollapsed = s.source_rows - s.events;

  return (
    <main className="wrap">
      <nav className="nav" aria-label="Primary">
        <Link className="brand" href="/" aria-label="ATLive home">
          <span className="mark">A</span>
          <span className="word">
            AT<b>Live</b>
          </span>
        </Link>
        <ul className="navlinks">
          <li>
            <Link href="/">
              <span className="idx">01</span> Events
            </Link>
          </li>
          <li>
            <Link href="/pipeline" aria-current="page">
              <span className="idx">02</span> Pipeline
            </Link>
          </li>
          <li>
            <Link href="/#about">
              <span className="idx">03</span> About
            </Link>
          </li>
        </ul>
      </nav>

      <header className="head hero">
        <h1>
          Pipeline &amp; <span className="accent">data quality</span>
        </h1>
        <p className="sub">
          ATLive isn&apos;t a static event list — it&apos;s a self-updating ingestion pipeline. Here&apos;s what
          runs under the hood, with live numbers from the database.
        </p>
      </header>

      <section className="metrics">
        <div className="metric">
          <div className="metric-n">{s.events}</div>
          <div className="metric-l">canonical events</div>
        </div>
        <div className="metric">
          <div className="metric-n">{s.by_source.length}</div>
          <div className="metric-l">sources aggregated</div>
        </div>
        <div className="metric">
          <div className="metric-n">{s.cross_source_merges}</div>
          <div className="metric-l">cross-source merges</div>
        </div>
        <div className="metric">
          <div className="metric-n">96.7%</div>
          <div className="metric-l">extraction accuracy</div>
        </div>
      </section>

      <section className="psec">
        <h2>Architecture</h2>
        <pre className="diagram">{DIAGRAM}</pre>
        <p className="note">
          Full code on <a href={REPO} target="_blank" rel="noopener noreferrer">GitHub</a> — Next.js + Supabase +
          TypeScript, ingest in GitHub Actions.
        </p>
      </section>

      <section className="psec">
        <h2>Dedup &amp; provenance</h2>
        <p className="note">
          One canonical row per real show; every source that reported it is linked in <code>event_sources</code>.
          {" "}<strong>{s.source_rows}</strong> raw source rows collapsed to <strong>{s.events}</strong> events
          {" "}({dupCollapsed} duplicate listings removed), with <strong>{s.cross_source_merges}</strong> show(s) seen
          in more than one source. Matching is exact-key first, then a token-set fuzzy fallback, guarded by a
          false-merge test so two different acts on the same night never merge.
        </p>
        <table className="ptable">
          <thead>
            <tr><th>Source</th><th>Events</th><th>Last ingested</th></tr>
          </thead>
          <tbody>
            {s.by_source.map((b) => (
              <tr key={b.source}>
                <td>{b.source}</td>
                <td>{b.count}</td>
                <td title={fmtAbs(b.last_seen)}>{rel(b.last_seen)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="psec">
        <h2>Extraction eval — 96.7%</h2>
        <p className="note">
          The hard part of scraping is pulling correct structured fields out of messy HTML/JSON. That step is
          scored, not guessed: <code>npm run eval</code> runs the parsers over captured raw fixtures and compares
          artist / date / venue extraction against hand-labeled ground truth.
        </p>
        <pre className="diagram small">{`Extraction accuracy: 29/30 fields correct (96.7%) across 10 labeled events
Miss: variety:1458556  artist: expected "feeble little horse",
                                got "feeble little horse: bitknot tour"`}</pre>
        <p className="note">
          The one miss is real and kept on purpose — the parser strips <code>&quot; - &quot;</code> tour suffixes but not
          <code>&quot;: &quot;</code> ones. An eval that always reads 100% is usually rigged; this one catches real edge
          cases and guards against regressions.
        </p>
      </section>

      <section className="psec">
        <h2>Recent ingest runs</h2>
        <p className="note">
          Every scheduled run (and local run) records here. Canonical logs:{" "}
          <a href={`${REPO}/actions`} target="_blank" rel="noopener noreferrer">GitHub Actions</a>.
        </p>
        {s.runs.length === 0 ? (
          <p className="note">No runs recorded yet — the next ingest will populate this.</p>
        ) : (
          <table className="ptable">
            <thead>
              <tr><th>When</th><th>Status</th><th>Sources</th><th>New</th><th>Merged</th><th>Blurbs</th></tr>
            </thead>
            <tbody>
              {s.runs.map((r, i) => (
                <tr key={i}>
                  <td title={fmtAbs(r.ran_at)}>{rel(r.ran_at)}</td>
                  <td>
                    <span className={`rstatus ${r.status === "success" ? "ok" : "bad"}`}>{r.status}</span>
                  </td>
                  <td className="srccell">
                    {r.sources
                      ? Object.entries(r.sources).map(([k, v]) => `${k} ${v}`).join(" · ")
                      : "—"}
                  </td>
                  <td>{r.created ?? "—"}</td>
                  <td>{r.merged ?? "—"}</td>
                  <td>{r.blurbs ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="foot">
        <Link href="/">← Back to events</Link> · Source: <a href={REPO} target="_blank" rel="noopener noreferrer">github.com/Watersingman50/atlive</a>
      </footer>
    </main>
  );
}
