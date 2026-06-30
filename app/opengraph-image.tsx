import { ImageResponse } from "next/og";
import { getUpcomingEvents } from "@/lib/events";

// Per-week OG/Twitter card for the homepage. Auto-attached by Next via the
// file convention. Regenerates on the ISR cycle, so the "shows this week"
// count and the week label stay current.

export const runtime = "nodejs";
export const revalidate = 3600;
export const alt = "ATLive - live music in Atlanta this week";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  let count = 0;
  try {
    const { events } = await getUpcomingEvents(7);
    count = events.length;
  } catch {
    count = 0;
  }
  const week = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#121212",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: "#FFB433",
              color: "#1a1206",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            A
          </div>
          <div style={{ fontSize: 40, color: "#f4f1ea", fontWeight: 800, letterSpacing: "-0.02em" }}>ATLive</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 88, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1.02 }}>
            <span style={{ color: "#f4f1ea" }}>Live music in&nbsp;</span>
            <span style={{ color: "#FFB433" }}>Atlanta</span>
          </div>
          <div style={{ display: "flex", fontSize: 34, color: "#a9a39a", marginTop: 26 }}>
            {count > 0 ? `${count} shows this week · updated automatically` : "Every gig this week, in one place"}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#8a857d", letterSpacing: "0.04em" }}>
          atlive.vercel.app · week of {week}
        </div>
      </div>
    ),
    { ...size },
  );
}
