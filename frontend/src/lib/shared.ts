"use client";
import { useEffect, useRef, useState } from "react";
import { api, defaultProfile, type Bill, type Profile } from "./api";
import { useSession } from "./supabase";

/** The last bill the user decoded or fetched, kept for this browser tab so the audit and battery pages can reuse it. */
export const savedBill = {
  get(): Bill | null { try { const s = sessionStorage.getItem("roshni-bill"); return s ? (JSON.parse(s) as Bill) : null; } catch { return null; } },
  set(b: Bill) { try { sessionStorage.setItem("roshni-bill", JSON.stringify(b)); } catch {} },
  clear() { try { sessionStorage.removeItem("roshni-bill"); } catch {} },
};

const KEY = "roshni-profile";

/**
 * Household profile that survives page changes and reloads (this device), and follows a signed-in user across devices.
 * Returns [profile, setProfile, savedFrom] where savedFrom says where the starting values came from.
 */
export function usePersistedProfile(): [Profile, (p: Profile | ((p: Profile) => Profile)) => void, "none" | "device" | "account"] {
  const { session, ready } = useSession();
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [from, setFrom] = useState<"none" | "device" | "account">("none");
  const loaded = useRef(false);
  const hadLocal = useRef(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) { hadLocal.current = true; queueMicrotask(() => { setProfile({ ...defaultProfile, ...JSON.parse(s) }); setFrom("device"); }); }
    } catch {}
    queueMicrotask(() => { loaded.current = true; });
  }, []);

  // Signed in: use the account's saved profile if this device has none
  useEffect(() => {
    if (!ready || !session) return;
    api.get<{ profile: Profile | null }>("/me/profile").then((r) => {
      if (r.profile && !hadLocal.current) { setProfile({ ...defaultProfile, ...r.profile }); setFrom("account"); }
    }).catch(() => {});
  }, [ready, session]);

  // Save on change (device immediately, account after a short pause)
  const edited = useRef(false);
  useEffect(() => {
    if (!loaded.current) return;
    if (!edited.current) { edited.current = true; return; }
    try { localStorage.setItem(KEY, JSON.stringify(profile)); } catch {}
    if (!session) return;
    const id = setTimeout(() => { api.put("/me/profile", profile).catch(() => {}); }, 1000);
    return () => clearTimeout(id);
  }, [profile, session]);

  return [profile, setProfile, from];
}
