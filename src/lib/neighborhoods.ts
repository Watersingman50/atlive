// Atlanta neighborhood lookup for browse-by-area filtering.
//
// Neighborhood isn't stored in the DB — it's derived client- and server-side
// from the venue name via substring match (venue strings vary slightly across
// sources, so exact keys would miss). Unknown venues fall back to "Atlanta".

export const UNKNOWN_NEIGHBORHOOD = "Atlanta";

// Ordered most-specific first; first substring hit wins.
const VENUE_NEIGHBORHOOD: [match: string, neighborhood: string][] = [
  ["variety playhouse", "Little Five Points"],
  ["aisle 5", "Little Five Points"],
  ["star bar", "Little Five Points"],
  ["529", "East Atlanta Village"],
  ["the earl", "East Atlanta Village"],
  ["terminal west", "West Midtown"],
  ["masquerade", "Old Fourth Ward"],
  ["the eastern", "Reynoldstown"],
  ["smith's olde bar", "Poncey-Highland"],
  ["smiths olde bar", "Poncey-Highland"],
  ["buckhead theatre", "Buckhead"],
  ["tabernacle", "Downtown"],
  ["state farm arena", "Downtown"],
  ["center stage", "Midtown"],
  ["the loft", "Midtown"],
  ["vinyl", "Midtown"],
  ["fox theatre", "Midtown"],
  ["the masquerade", "Old Fourth Ward"],
  ["coca-cola roxy", "The Battery"],
  ["cadence bank amphitheatre", "Lakewood"],
  ["chastain", "Buckhead"],
];

export function neighborhoodOf(venue: string | null): string {
  if (!venue) return UNKNOWN_NEIGHBORHOOD;
  const v = venue.toLowerCase();
  for (const [match, hood] of VENUE_NEIGHBORHOOD) {
    if (v.includes(match)) return hood;
  }
  return UNKNOWN_NEIGHBORHOOD;
}
