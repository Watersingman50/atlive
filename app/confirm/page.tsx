import Link from "next/link";
import type { Metadata } from "next";
import { confirm } from "@/lib/subscribers";

export const dynamic = "force-dynamic"; // mutates by token, per-request
export const metadata: Metadata = { title: "ATLive — Confirm subscription", robots: { index: false } };

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token ? await confirm(token) : "notfound";

  const copy =
    result === "confirmed"
      ? { h: "You're in.", p: "You'll get the Monday roundup of live music in Atlanta. See you in your inbox." }
      : result === "already"
        ? { h: "Already confirmed.", p: "You're on the list — nothing more to do." }
        : { h: "That link didn't work.", p: "It may have expired or already been used. Try signing up again from the homepage." };

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
