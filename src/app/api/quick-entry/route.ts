import { getQuickEntryData } from "@/lib/db/queries";
import { getWriteAccess } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getWriteAccess())) {
    return Response.json({ error: "Unauthorized" }, { status: 403 });
  }

  const data = await getQuickEntryData();
  return Response.json(data, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
