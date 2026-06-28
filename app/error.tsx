"use client";

// Friendly fallback if a render fails with no cached page to fall back to.
// Pairs with the never-empty throw in page.tsx (which lets ISR keep the
// last-good render in the normal case).
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="wrap">
      <div className="empty">
        <p>Couldn&apos;t load events right now.</p>
        <button className="pill on" style={{ marginTop: 16 }} onClick={() => reset()}>
          Try again
        </button>
      </div>
    </main>
  );
}
