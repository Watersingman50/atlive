import Link from "next/link";
import type { Metadata } from "next";
import { getPipelineStats } from "@/lib/events";
import type { EvalResult } from "@/lib/extraction-eval";
import BrandMark from "../BrandMark";
import { ArchitectureFlow, AccuracyBars, SourceBars, DedupViz, IngestVolume } from "./Charts";
import evalJson from "../../eval/results.json";

export const revalidate = 3600;

const result = evalJson as EvalResult;

export const metadata: Metadata = {
  title: "ATLive - How it works",
  description: "The engine behind ATLive: scheduled ingest, cross-source dedupe, and a measured extraction eval.",
  alternates: { canonical: "/pipeline" },
  openGraph: { type: "website", url: "/pipeline" },
};

const REPO = "https://github.com/Watersingman50/atlive";

const fmtAbs = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "-";

function rel(iso: string | null): string {
  if (!iso) return "-";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default async function Pipeline() {
  const s = await getPipelineStats();
  if (!s) throw new Error("pipeline stats unavailable"); // ISR keeps last-good

  const miss = result.misses[0];

  return (
    <main className="wrap">
      <nav className="nav" aria-label="Primary">
        <Link className="brand" href="/" aria-label="ATLive home">
          <BrandMark className="mark" />
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
        <div className="eyebrow">
          <span className="pulse" />
          How it works
        </div>
        <h1>
          The engine behind <span className="accent">the board</span>
        </h1>
        <p className="sub">
          ATLive isn&apos;t a hand-kept list. A scheduled pipeline ingests, dedupes, and measures itself. Every number
          here is live from the database or the eval harness - nothing is typed in by hand.
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
          <div className="metric-n">{result.overall.pct}%</div>
          <div className="metric-l">extraction accuracy</div>
        </div>
      </section>

      <section className="psec">
        <h2>Architecture</h2>
        <ArchitectureFlow />
        <p className="note small">
          Next.js + Supabase + TypeScript, ingest in GitHub Actions. Full source on{" "}
          <a href={REPO} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          .
        </p>
      </section>

      <section className="psec">
        <h2>Extraction accuracy</h2>
        <AccuracyBars result={result} />
        {miss && (
          <p className="note small">
            The one miss is kept on purpose: the parser strips <code>&quot; - &quot;</code> tour suffixes but not{" "}
            <code>&quot;: &quot;</code> ones (<code>{miss.got}</code>). An eval that always reads 100% is usually rigged.
          </p>
        )}
      </section>

      <section className="psec">
        <h2>Dedup &amp; provenance</h2>
        <DedupViz sourceRows={s.source_rows} events={s.events} merges={s.cross_source_merges} />
      </section>

      <section className="psec">
        <h2>Sources</h2>
        <SourceBars sources={s.by_source} />
      </section>

      <section className="psec">
        <h2>Ingest runs</h2>
        <IngestVolume runs={s.runs} />
        {s.runs.length > 0 && (
          <table className="ptable">
            <thead>
              <tr>
                <th>When</th>
                <th>Status</th>
                <th>New</th>
                <th>Merged</th>
                <th>Blurbs</th>
              </tr>
            </thead>
            <tbody>
              {s.runs.map((r, i) => (
                <tr key={i}>
                  <td title={fmtAbs(r.ran_at)}>{rel(r.ran_at)}</td>
                  <td>
                    <span className={`rstatus ${r.status === "success" ? "ok" : "bad"}`}>{r.status}</span>
                  </td>
                  <td>{r.created ?? "-"}</td>
                  <td>{r.merged ?? "-"}</td>
                  <td>{r.blurbs ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="note small">
          Canonical logs:{" "}
          <a href={`${REPO}/actions`} target="_blank" rel="noopener noreferrer">
            GitHub Actions
          </a>
          .
        </p>
      </section>

      <footer className="foot">
        <Link href="/">← Back to events</Link> · Source:{" "}
        <a href={REPO} target="_blank" rel="noopener noreferrer">
          github.com/Watersingman50/atlive
        </a>
      </footer>
    </main>
  );
}
