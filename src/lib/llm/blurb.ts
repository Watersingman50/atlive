import Anthropic from "@anthropic-ai/sdk";

// LLM blurb generation (T8). claude-haiku-4-5, generated once per event and
// stored on the canonical row. One short sentence; cheap (~$0.0002/blurb at
// $1/$5 per Mtok). On any failure returns null — the caller leaves blurb null,
// the page falls back to the title, and the next run retries (generate-once).

export interface BlurbInput {
  title: string;
  artist: string | null;
  venue: string | null;
}

const SYSTEM = `You write one-sentence preview blurbs for live-music events in Atlanta.
Rules: exactly one sentence, at most 22 words, present tense, concrete and inviting.
No emoji, no hashtags, no surrounding quotation marks, do not mention the date.
Output only the sentence.`;

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  client ??= new Anthropic({ apiKey });
  return client;
}

export function blurbsEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function generateBlurb(input: BlurbInput): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;
  const who = input.artist || input.title;
  const where = input.venue ?? "an Atlanta venue";

  try {
    const res = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 64,
      system: SYSTEM,
      messages: [
        { role: "user", content: `Event: ${input.title}\nArtist: ${who}\nVenue: ${where}` },
      ],
    });
    const text = res.content
      .find((b): b is Anthropic.TextBlock => b.type === "text")
      ?.text.replace(/\s+/g, " ")
      .trim();
    return text && text.length > 0 ? text : null;
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("[blurb] rate-limited; skipping rest of batch");
      throw err; // let the caller stop the batch cleanly
    }
    console.error(`[blurb] failed for "${input.title}": ${(err as Error).message}`);
    return null; // leave blurb null; page shows title; retried next run
  }
}
