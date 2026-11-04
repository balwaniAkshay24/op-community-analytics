import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { statbot } from "@/lib/statbot/client";
import { ENDPOINTS, type EndpointId } from "@/lib/statbot/endpoints";
import { DEFAULT_DAYS, rangeParams } from "@/lib/statbot/range";

/**
 * Developer page: calls every endpoint live and shows the raw response, so we can
 * confirm paths, query parameters and field names. Only opens with ?token=EXPLORER_TOKEN.
 */
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "API explorer",
  robots: { index: false, follow: false },
};

const MAX_CHARS = 4000;

function describe(query: Record<string, string | string[]>): string {
  return Object.entries(query)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : v}`)
    .join(", ");
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ExplorerPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const expected = process.env.EXPLORER_TOKEN ?? "";
  if (!expected || token !== expected) notFound();

  const withRange = params.range !== "off";
  const only =
    typeof params.only === "string" && params.only in ENDPOINTS
      ? (params.only as EndpointId)
      : null;
  const ids = only ? [only] : (Object.keys(ENDPOINTS) as EndpointId[]);
  const query = rangeParams(DEFAULT_DAYS);

  const results = await Promise.all(
    ids.map(async (id) => {
      const def = ENDPOINTS[id];
      const result = await statbot(id, {
        fresh: true,
        query: withRange && def.range ? query : undefined,
      });
      return { id, def, result };
    }),
  );

  const toggle = new URLSearchParams({
    token,
    range: withRange ? "off" : "on",
    ...(only ? { only } : {}),
  });

  return (
    <>
      <PageHeader
        title="API explorer"
        description={`Live responses from Statbot, not cached. A full run takes about 30 seconds because of Statbot’s rate limit. ${
          withRange
            ? `Range and filter parameters sent: ${describe(query)}`
            : "No range or filter parameters sent."
        }`}
      />
      <p className="panel-description" style={{ marginBottom: "1.25rem" }}>
        <Link href={`/explorer?${toggle.toString()}`}>
          {withRange
            ? "Call again without range parameters"
            : "Call again with range parameters"}
        </Link>
        {only ? (
          <>
            {"  |  "}
            <Link href={`/explorer?token=${encodeURIComponent(token)}`}>
              Show all endpoints
            </Link>
          </>
        ) : null}
      </p>

      <div className="explorer-list">
        {results.map(({ id, def, result }) => {
          const json = result.ok ? JSON.stringify(result.data, null, 2) : null;
          const rl = result.rateLimit;
          return (
            <section key={id} className="panel">
              <h2 className="panel-title">
                {def.label}{" "}
                <span
                  className="badge"
                  title={
                    def.verified
                      ? "Path taken from the docs"
                      : "Path inferred, check it"
                  }
                >
                  {def.verified ? "path from docs" : "path inferred"}
                </span>
              </h2>
              <div className="explorer-meta">
                <span>
                  <Link
                    href={`/explorer?${new URLSearchParams({ token, only: id, range: withRange ? "on" : "off" })}`}
                  >
                    {id}
                  </Link>
                </span>
                <span>
                  {result.url
                    ? new URL(result.url).pathname + new URL(result.url).search
                    : def.path}
                </span>
                <span>Status {result.status ?? "none"}</span>
                {rl ? (
                  <span>
                    Rate limit {rl.remaining ?? "?"}/{rl.limit ?? "?"}, resets
                    in {rl.reset ?? "?"}s
                  </span>
                ) : null}
              </div>
              {result.dropped.length > 0 ? (
                <p className="panel-description">
                  Statbot doesn&rsquo;t accept {result.dropped.join(", ")} here,
                  so {result.dropped.length === 1 ? "it was" : "they were"} left
                  out.
                </p>
              ) : null}
              {result.ok ? (
                <pre className="explorer-json">
                  {json!.length > MAX_CHARS
                    ? `${json!.slice(0, MAX_CHARS)}\n\u2026 (${json!.length} characters, truncated)`
                    : json}
                </pre>
              ) : (
                <p className="notice notice-error">{result.error}</p>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}
