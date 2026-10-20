"use client";

import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from "recharts";
import { formatMinor } from "@/lib/finance/money";

type TrendPoint = { date: string; expense_minor: string; income_minor: string };
type CategoryPoint = { label: string; expense_minor: string };

function axisAmount(value: number): string {
  const rupees = value / 100;
  return rupees >= 100_000 ? `Rs ${(rupees / 1000).toFixed(0)}k` : `Rs ${Math.round(rupees)}`;
}

export function SpendingTrendChart({ points }: { points: TrendPoint[] }) {
  if (!points.some((point) => BigInt(point.expense_minor) > 0n)) return null;
  const chart = points.map((point) => ({ ...point, expense: Number(point.expense_minor) }));
  return <div className="h-64 w-full" role="img" aria-label="Daily spending trend; exact daily amounts are listed below the chart.">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chart} accessibilityLayer margin={{ top: 8, right: 10, left: 0, bottom: 0 }}>
        <defs><linearGradient id="spending-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#047857" stopOpacity={0.3} /><stop offset="100%" stopColor="#047857" stopOpacity={0.02} /></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" vertical={false} />
        <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} minTickGap={18} tick={{ fill: "#57534e", fontSize: 11 }} />
        <YAxis tickFormatter={axisAmount} width={75} tick={{ fill: "#57534e", fontSize: 11 }} />
        <Tooltip content={({ active, payload }) => {
          const point = payload?.[0]?.payload as (typeof chart)[number] | undefined;
          return active && point ? <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-lg"><p className="font-medium">{point.date}</p><p>Expenses: {formatMinor(point.expense_minor)}</p></div> : null;
        }} />
        <Area type="monotone" dataKey="expense" stroke="#047857" strokeWidth={2} fill="url(#spending-fill)" isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

export function CategorySpendingChart({ points }: { points: CategoryPoint[] }) {
  if (!points.length) return null;
  const chart = points.slice(0, 6).map((point) => ({ ...point, expense: Number(point.expense_minor) }));
  return <div className="h-64 w-full" role="img" aria-label="Largest category allocations; exact amounts are listed below the chart.">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={chart} accessibilityLayer layout="vertical" margin={{ top: 6, right: 8, left: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e7e5e4" horizontal={false} />
        <XAxis type="number" tickFormatter={axisAmount} tick={{ fill: "#57534e", fontSize: 11 }} />
        <YAxis type="category" dataKey="label" width={104} tick={{ fill: "#57534e", fontSize: 11 }} />
        <Tooltip content={({ active, payload }) => {
          const point = payload?.[0]?.payload as (typeof chart)[number] | undefined;
          return active && point ? <div className="rounded-xl border border-stone-200 bg-white p-3 text-sm shadow-lg"><p className="font-medium">{point.label}</p><p>{formatMinor(point.expense_minor)}</p></div> : null;
        }} />
        <Bar dataKey="expense" fill="#047857" radius={[0, 6, 6, 0]} isAnimationActive={false} />
      </BarChart>
    </ResponsiveContainer>
  </div>;
}
