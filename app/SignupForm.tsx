"use client";

import { useState } from "react";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) {
        setState("error");
        setMsg(j.error ?? "Something went wrong.");
        return;
      }
      setState("done");
      setMsg(j.message ?? "Almost there - check your inbox to confirm.");
    } catch {
      setState("error");
      setMsg("Network error - try again.");
    }
  }

  return (
    <section className="signup-band" id="newsletter">
      <h2>Get the Monday roundup</h2>
      <p>One email a week: the best live music coming to Atlanta. No spam, unsubscribe anytime.</p>
      {state === "done" ? (
        <p className="signup-done" role="status">
          {msg}
        </p>
      ) : (
        <form className="signup" onSubmit={submit}>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            aria-label="Email address"
            disabled={state === "loading"}
          />
          <button type="submit" disabled={state === "loading"}>
            {state === "loading" ? "…" : "Subscribe"}
          </button>
          {state === "error" && (
            <span className="signup-err" role="alert">
              {msg}
            </span>
          )}
        </form>
      )}
    </section>
  );
}
