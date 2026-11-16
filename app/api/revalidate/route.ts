import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { CACHE_TAG } from "@/lib/statbot/config";

/**
 * Refresh all Statbot data now instead of waiting for the 3-hour cycle.
 *   curl -X POST "https://<your-site>/api/revalidate?secret=<REVALIDATE_SECRET>"
 * or, to keep the secret out of request logs:
 *   curl -X POST -H "Authorization: Bearer <REVALIDATE_SECRET>" "https://<your-site>/api/revalidate"
 */
function matches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const bearer = request.headers
    .get("authorization")
    ?.replace(/^Bearer\s+/i, "");
  const secret =
    bearer ?? new URL(request.url).searchParams.get("secret") ?? "";
  const expected = process.env.REVALIDATE_SECRET ?? "";

  if (!expected || !matches(secret, expected)) {
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
