import { createClient } from "@supabase/supabase-js";

// Launch-day lever. While WAITLIST_MODE is on, signups are stored as 'pending'
// with no confirm email. Once you verify a Resend sending domain, run this once
// to promote every pending waitlist signup to 'confirmed' so the weekly digest
// reaches them:
//
//   npm run waitlist:promote   # then: npm run digest  (or let the Monday cron send)
//
// Only touches 'pending' rows. Idempotent — re-running promotes nothing new.

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("promote-waitlist: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set");
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await sb
    .from("subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("status", "pending")
    .select("email");
  if (error) {
    console.error(`promote-waitlist: ${error.message}`);
    process.exit(1);
  }
  console.log(`promote-waitlist: promoted ${data?.length ?? 0} waitlist signup(s) to confirmed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
