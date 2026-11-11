"use client";
import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let client: SupabaseClient | null = null;

/** Browser Supabase client (sessions kept in cookies by @supabase/ssr). Null when sign-in isn't configured. */
export function supabase(): SupabaseClient | null {
  if (!url || !key || typeof window === "undefined") return null;
  client ??= createBrowserClient(url, key);
  return client;
}

export async function accessToken(): Promise<string | null> {
  const sb = supabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

export function useSession(): { session: Session | null; ready: boolean } {
  const [state, setState] = useState<{ session: Session | null; ready: boolean }>({ session: null, ready: false });
  useEffect(() => {
    const sb = supabase();
    if (!sb) { queueMicrotask(() => setState({ session: null, ready: true })); return; }
    sb.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }));
    const { data: sub } = sb.auth.onAuthStateChange((_e, session) => setState({ session, ready: true }));
    return () => sub.subscription.unsubscribe();
  }, []);
  return state;
}

// Anonymous ownership: the creator's private token for each report, kept only in this browser.
export const ownerToken = {
  get(id: string): string | null { try { return localStorage.getItem(`roshni-owner-${id}`); } catch { return null; } },
  set(id: string, t: string) { try { localStorage.setItem(`roshni-owner-${id}`, t); } catch {} },
  remove(id: string) { try { localStorage.removeItem(`roshni-owner-${id}`); } catch {} },
};
