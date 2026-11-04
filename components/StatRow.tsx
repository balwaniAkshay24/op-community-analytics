export type Stat = {
  label: string;
  value: string | null;
  detail?: string | null;
  tone?: "positive" | "negative" | "neutral";
};

export function StatRow({ stats }: { stats: Stat[] }) {
  return (
    <dl className="stat-row">
      {stats.map((stat) => (
        <div key={stat.label} className="stat">
          <dt className="stat-label">{stat.label}</dt>
          <dd className="stat-value">{stat.value ?? "\u2013"}</dd>
          {stat.detail ? (
            <dd className={`stat-detail tone-${stat.tone ?? "neutral"}`}>
              {stat.detail}
            </dd>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
