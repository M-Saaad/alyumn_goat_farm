/**
 * Smoke test for guest role helpers (no Supabase required).
 */
import assert from "node:assert/strict";

// When Supabase is not configured, local dev keeps full write access.
process.env.NEXT_PUBLIC_SUPABASE_URL = "";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "";

const { getWriteAccess, getSessionRole } = await import("../lib/auth/roles");

assert.equal(await getSessionRole(), "partner");
assert.equal(await getWriteAccess(), true);

console.log("verify-guest-roles: ok");
