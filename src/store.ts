// Persistence. localStorage is the source of truth the game reads; Supabase is
// the sync layer so a save follows the kid to another device. The game never
// blocks on the network — offline just means the next push carries the change.

import { createClient } from "@supabase/supabase-js";
import { type State, type Area, newState, newer, migrate, makeCode, CODE_RE } from "./state.ts";

const KEY = "catworld:save";
const CODEKEY = "catworld:code";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
// No env vars? Run offline. The whole game still works on one device.
export const sb = url && anon ? createClient(url, anon) : null;
export const online = () => sb !== null;

// localStorage throws in private mode / blocked-storage setups. Never let that
// take down the game.
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export function myCode(): string {
  let c = get(CODEKEY);
  if (!c || !CODE_RE.test(c)) {
    c = makeCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    set(CODEKEY, c);
  }
  return c;
}

export const loadLocal = (): State | null => {
  const raw = get(KEY);
  if (!raw) return null;
  try { return migrate(JSON.parse(raw)); } catch { return null; }
};

const pull = async (code: string): Promise<State | null> => {
  if (!sb) return null;
  const { data, error } = await sb.rpc("save_get", { p_code: code });
  if (error) { console.warn("pull failed", error.message); return null; }
  return migrate(data);
};

let timer: ReturnType<typeof setTimeout> | undefined;
/** Write local now, push to the server on a 3s debounce. */
export function save(s: State) {
  set(KEY, JSON.stringify(s));
  if (!sb) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    sb.rpc("save_put", { p_code: myCode(), p_data: s })
      .then(({ error }) => error && console.warn("push failed", error.message));
  }, 3000);
}

// --- attempt log: what the kid got right and wrong, per skill ---------------
type Attempt = { area: Area; skill: string; correct: boolean };
let queue: Attempt[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

export function logAttempt(a: Attempt) {
  if (!sb) return;
  queue.push(a);
  clearTimeout(flushTimer);
  flushTimer = setTimeout(flushAttempts, 5000);
  if (queue.length >= 20) flushAttempts();
}

function flushAttempts() {
  if (!sb || queue.length === 0) return;
  const rows = queue.splice(0, 100);
  sb.rpc("attempts_log", { p_code: myCode(), p_rows: rows })
    .then(({ error }) => { if (error) { console.warn("log failed", error.message); queue.unshift(...rows); } });
}

/** Local save, reconciled with whatever the server has. Newest wins. */
export async function boot(): Promise<State> {
  const local = loadLocal();
  const remote = await pull(myCode()).catch(() => null);
  const s = newer(local, remote) ?? newState();
  save(s);
  return s;
}

/** Type a tag from another device to pull that cat down. */
export async function restore(code: string): Promise<State> {
  const c = code.trim().toUpperCase();
  if (!CODE_RE.test(c)) throw new Error("That tag doesn't look right — 8 letters and numbers.");
  const remote = await pull(c);
  if (!remote) throw new Error("No cat found with that tag.");
  set(CODEKEY, c);
  save(remote);
  return remote;
}
