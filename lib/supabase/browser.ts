// Anon Supabase client for the browser. Used for Realtime subscriptions and
// for reading the `public_numbers` view + `rounds` table.
"use client";
import { createClient } from "@supabase/supabase-js";

let cached: ReturnType<typeof createClient> | null = null;

export function sbBrowser() {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { realtime: { params: { eventsPerSecond: 20 } } }
    );
  }
  return cached;
}
