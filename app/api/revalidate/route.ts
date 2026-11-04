import { revalidateTag } from "next/cache";
import { CACHE_TAG } from "@/lib/statbot/config";

/**
 * Refresh all Statbot data now instead of waiting for the 3-hour cycle.
 *   curl -X POST "https://<your-site>/api/revalidate?secret=<REVALIDATE_SECRET>"
 */
export async function POST(request: Request) {
  const secret = new URL(request.url).searchParams.get("secret");
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || secret !== expected) {
    return Response.json(
      { ok: false, error: "Wrong or missing secret." },
      { status: 401 },
    );
  }

  revalidateTag(CACHE_TAG);
  return Response.json({
    ok: true,
    revalidated: CACHE_TAG,
    at: new Date().toISOString(),
  });
}
