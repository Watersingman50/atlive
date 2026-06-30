import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getUpcomingEvents } from "@/lib/events";
import { itemListJsonLd, jsonLdScript } from "@/lib/seo";
import { findLanding, landingPages, landingSlugs } from "@/lib/landing";
import BrandMark from "../BrandMark";
import SignupForm from "../SignupForm";
import LandingEvents from "./LandingEvents";

// Neighborhood + genre SEO landing pages. Static set, pre-rendered at build
// (dynamicParams=false → unknown slugs 404, so this never shadows /pipeline,
// /confirm, etc.). ISR-revalidated hourly like the homepage.
export const revalidate = 3600;
export const dynamicParams = false;

export function generateStaticParams() {
  return landingSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = findLanding(slug);
  if (!page) return {};
  const url = `/${page.slug}`;
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: { type: "website", url, title: page.title, description: page.description },
    twitter: { card: "summary_large_image", title: page.title, description: page.description },
  };
}

export default async function LandingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = findLanding(slug);
  if (!page) notFound();

  const { events, error } = await getUpcomingEvents(14);
  // Match the homepage liveness contract: a failed query throws so ISR keeps
  // the last good render rather than caching a broken page.
  if (error) throw new Error(`events query failed: ${error}`);

  const matched = events.filter(page.match);

  // Cross-links to sibling landing pages of the same kind — internal linking
  // that helps crawl depth and keeps visitors funnelling through the site.
  const siblings = landingPages().filter((p) => p.kind === page.kind && p.slug !== page.slug);

  return (
    <main className="wrap">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdScript(itemListJsonLd(matched, page.title)) }}
      />

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
            <Link href="/pipeline">
              <span className="idx">02</span> Pipeline
            </Link>
          </li>
        </ul>
      </nav>

      <header className="head hero">
        <div className="eyebrow">
          <span className="pulse" />
          {page.kind === "neighborhood" ? "Atlanta · neighborhood" : "Atlanta · genre"} · auto-updated
        </div>
        <h1>{page.h1}</h1>
        <p className="sub">{page.intro}</p>
        <p className="stat" aria-live="polite">
          <span className="livedot" />
          <strong>{matched.length}</strong> upcoming {matched.length === 1 ? "show" : "shows"}
        </p>
      </header>

      <LandingEvents events={matched} />

      <nav className="browse" aria-label={`Other ${page.kind === "neighborhood" ? "neighborhoods" : "genres"}`}>
        <h2 className="browse-h">
          {page.kind === "neighborhood" ? "Other Atlanta neighborhoods" : "Browse by genre"}
        </h2>
        <ul className="browse-links">
          {siblings.map((p) => (
            <li key={p.slug}>
              <Link href={`/${p.slug}`}>{p.label}</Link>
            </li>
          ))}
          <li>
            <Link href="/">All Atlanta →</Link>
          </li>
        </ul>
      </nav>

      <SignupForm />

      <footer className="foot">
        Built in Atlanta · showtimes from venues + Ticketmaster ·{" "}
        <Link href="/">all live music in Atlanta</Link>.
      </footer>
    </main>
  );
}
