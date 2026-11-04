"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtAxis, fmtValue, type ValueFormat } from "@/lib/format";
import type { ChartDatum } from "@/lib/statbot/normalize";
import { useThemeColors } from "./useThemeColors";

type Series = { key: string; name: string };

type Props = {
  data: ChartDatum[];
  series: Series[];
  format?: ValueFormat;
  height?: number;
  /** Accessible summary of what the chart shows. */
  summary: string;
};

export function TrendChart({
  data,
  series,
  format = "number",
  height = 280,
  summary,
}: Props) {
  const c = useThemeColors();
  const palette = [c.accent, c.accent2, c.accent3];

  return (
    <figure
      className="chart"
      role="img"
      aria-label={summary}
      style={{ height }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            stroke={c.rule}
            strokeDasharray="2 4"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: c.muted, fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: c.rule }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: c.muted, fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => fmtAxis(v, format)}
          />
          <Tooltip
            cursor={{ stroke: c.muted, strokeWidth: 1 }}
            contentStyle={{
              background: c.surface,
              border: `1px solid ${c.rule}`,
              borderRadius: 8,
              color: c.ink,
              fontSize: 13,
            }}
            labelStyle={{ color: c.muted }}
            formatter={(value: number, name: string) => [
              fmtValue(value, format),
              name,
            ]}
          />
          {series.length > 1 ? (
            <Legend
              iconType="plainline"
              wrapperStyle={{ fontSize: 13, color: c.muted }}
            />
          ) : null}
          {series.map((s, i) => {
            const color = palette[i % palette.length];
            return (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.name}
                stroke={color}
                strokeWidth={i === 0 ? 2.25 : 1.75}
                fill={color}
                fillOpacity={i === 0 && series.length === 1 ? 0.12 : 0}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            );
          })}
        </AreaChart>
      </ResponsiveContainer>
    </figure>
  );
}
