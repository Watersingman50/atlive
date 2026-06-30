import Link from "next/link";
import type { Metadata } from "next";
import { unsubscribe } from "@/lib/subscribers";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "ATLive - Unsubscribe", robots: { index: false } };

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await unsubscribe(token) : "notfound";

  const copy =
    result === "unsubscribed"
      ? { h: "You're unsubscribed.", p: "You won't get any more ATLive emails. No hard feelings - the site's always here." }
      : { h: "That link didn't work.", p: "It may already have been used. If you're still getting emails, reply and let us know." };

  return (
    <main className="wrap">
      <div className="msgcard">
        <div className="msgmark" aria-hidden="true">A</div>
        <h1>{copy.h}</h1>
        <p>{copy.p}</p>
        <Link className="empty-act" href="/">
          ← Back to events
        </Link>
      </div>
    </main>
  );
}
