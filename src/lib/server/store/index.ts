import "server-only";
import { assertProductionConfig, env, isSupabaseConfigured } from "../env";
import { LocalStore } from "./local";
import { SupabaseStore } from "./supabase";
import type { Store } from "./types";

const g = globalThis as unknown as { __alanaStore?: Store };

export function getStore(): Store {
  if (g.__alanaStore) return g.__alanaStore;
  assertProductionConfig();
  g.__alanaStore = isSupabaseConfigured()
    ? new SupabaseStore(env.supabaseUrl, env.supabaseSecretKey)
    : new LocalStore();
  return g.__alanaStore;
}

export type { Store } from "./types";
