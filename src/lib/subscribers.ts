import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Newsletter subscriber data access (server-side only; service-role key).
// Double opt-in: subscribe() inserts/refreshes a 'pending' row with a fresh
// token; confirm()/unsubscribe() flip status by token.

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export type SignupResult =
  | { ok: true; status: "pending"; email: string; token: string }
  | { ok: true; status: "already" }
  | { ok: false; error: string };

export async function subscribe(emailRaw: string): Promise<SignupResult> {
  const email = (emailRaw ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Enter a valid email." };
  const sb = db();
  if (!sb) return { ok: false, error: "Signups aren't configured." };

  const { data: existing } = await sb
    .from("subscribers")
    .select("status")
    .eq("email", email)
    .maybeSingle();
  if (existing?.status === "confirmed") return { ok: true, status: "already" };

  // (Re)create as pending with a fresh token. App-generated token so re-signup
  // rotates it (a DB default only fires on insert, not on conflict-update).
  const token = randomUUID();
  const { error } = await sb.from("subscribers").upsert(
    {
      email,
      status: "pending",
      token,
      created_at: new Date().toISOString(),
      confirmed_at: null,
      unsubscribed_at: null,
    },
    { onConflict: "email" },
  );
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: "pending", email, token };
}

export async function confirm(token: string): Promise<"confirmed" | "already" | "notfound"> {
  const sb = db();
  if (!sb || !token) return "notfound";
  const { data } = await sb.from("subscribers").select("id,status").eq("token", token).maybeSingle();
  if (!data) return "notfound";
  if (data.status === "confirmed") return "already";
  await sb
    .from("subscribers")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", data.id);
  return "confirmed";
}

export async function unsubscribe(token: string): Promise<"unsubscribed" | "notfound"> {
  const sb = db();
  if (!sb || !token) return "notfound";
  const { data } = await sb.from("subscribers").select("id").eq("token", token).maybeSingle();
  if (!data) return "notfound";
  await sb
    .from("subscribers")
    .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
    .eq("id", data.id);
  return "unsubscribed";
}

export async function getConfirmedSubscribers(): Promise<{ email: string; token: string }[]> {
  const sb = db();
  if (!sb) return [];
  const { data } = await sb.from("subscribers").select("email,token").eq("status", "confirmed");
  return data ?? [];
}
