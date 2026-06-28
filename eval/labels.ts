// Hand-labeled ground truth for the extraction eval (T5). Each entry is a real
// event from the captured fixtures, with the CORRECT extracted fields as judged
// by a human reading the raw source — independent of what the parser produces.
// The eval (run.ts) parses the fixtures and scores the parser against these.

export interface Label {
  source: "variety" | "529";
  id: string; // matches CanonicalEvent.sourceEventId from the parser
  artist: string;
  eventDate: string; // YYYY-MM-DD
  venue: string;
}

export const LABELS: Label[] = [
  // --- Variety Playhouse (AEG JSON) ---
  { source: "variety", id: "1324695", artist: "Josiah and the Bonnevilles", eventDate: "2026-06-30", venue: "Variety Playhouse" }, // tour suffix " - The Redline..." should be stripped
  { source: "variety", id: "1268471", artist: "Dedrick Flynn", eventDate: "2026-07-10", venue: "Variety Playhouse" },
  { source: "variety", id: "1313102", artist: "American Football", eventDate: "2026-07-16", venue: "Variety Playhouse" },
  { source: "variety", id: "1458556", artist: "feeble little horse", eventDate: "2026-07-17", venue: "Variety Playhouse" }, // tricky: ": bitknot tour" suffix (parser only strips " - ")
  { source: "variety", id: "1240968", artist: "Chance Peña", eventDate: "2026-08-04", venue: "Variety Playhouse" }, // unicode (ñ)

  // --- 529 (scraped calendar HTML) ---
  { source: "529", id: "14588@2026-06-30", artist: "Sammy Brasher", eventDate: "2026-06-30", venue: "529" },
  { source: "529", id: "14826@2026-06-01", artist: "Drosera", eventDate: "2026-06-01", venue: "529" },
  { source: "529", id: "14609@2026-06-02", artist: "Flesh Carving", eventDate: "2026-06-02", venue: "529" },
  { source: "529", id: "14787@2026-06-03", artist: "Spencer Scott Smith & The Cherokee Roses", eventDate: "2026-06-03", venue: "529" }, // HTML entity &amp; decode
  { source: "529", id: "14846@2026-06-04", artist: "Heroes For Ghosts", eventDate: "2026-06-04", venue: "529" },
];
