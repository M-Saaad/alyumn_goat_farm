/**
 * Create a view-only guest Supabase user.
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in env.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/create-guest-user.mts
 *   npx tsx --env-file=.env.local scripts/create-guest-user.mts guest@example.com 'SecurePass123!'
 */
import { createServiceClient } from "../lib/supabase/admin";

const DEFAULT_EMAIL = "guest@farm.app";
const DEFAULT_PASSWORD = "GuestView2026!";

async function main() {
  const email = process.argv[2]?.trim() || process.env.GUEST_EMAIL || DEFAULT_EMAIL;
  const password = process.argv[3] || process.env.GUEST_PASSWORD || DEFAULT_PASSWORD;

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. --env-file=.env.local)");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const admin = createServiceClient();

  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

  let userId: string;
  if (found) {
    userId = found.id;
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      console.error("Could not update existing user:", updateError.message);
      process.exit(1);
    }
    console.log("Updated existing user password:", email);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error || !data.user) {
      console.error("Could not create user:", error?.message ?? "unknown error");
      process.exit(1);
    }
    userId = data.user.id;
    console.log("Created guest user:", email);
  }

  const { error: profileError } = await admin.from("profiles").upsert(
    { id: userId, role: "guest" },
    { onConflict: "id" }
  );
  if (profileError) {
    console.error(
      "User exists but profiles upsert failed. Run migration 015_user_roles.sql first:",
      profileError.message
    );
    process.exit(1);
  }

  console.log("");
  console.log("Guest credentials (view-only):");
  console.log("  Email:   ", email);
  console.log("  Password:", password);
  console.log("");
  console.log("This account can browse all farm data but cannot add, edit, or delete records.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
