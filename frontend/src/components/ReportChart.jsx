import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "./ui/skeleton";

const INDIGO = "#605BE5";
const MUTED = "#6B6B80";
const LINE = "#E7E5F5";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lift">
      <div className="font-medium">{label}</div>
      <div className="font-mono text-muted">
        {payload[0].value} {payload[0].value === 1 ? "document" : "documents"}
      </div>
    </div>
  );
}

/** Documents per option of one select field, from /api/stats `by_group`. */
export default function ReportChart({ group, loading }) {
  const reduced = useReducedMotion();

  if (loading) {
    return <Skeleton className="h-52 w-full rounded-xl" />;
  }
  if (!group) {
    return <p className="text-sm text-muted">Add a select field in Settings to see a breakdown here.</p>;
  }

  const data = group.counts.map((row) => ({ name: row.value ?? "Not set", count: row.count }));
  // Horizontal bars leave room for long option names.
  const height = Math.max(180, data.length * 40);
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart of documents by ${group.field}`}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={LINE} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontSize: 11, fontFamily: "Geist Mono Variable" }} />
          <YAxis
            type="category"
            dataKey="name"
            width={104}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#0A0A0A", fontSize: 12, fontFamily: "Geist Variable" }}
          />
          <Tooltip cursor={{ fill: "#F3F2FD" }} isAnimationActive={false} content={<ChartTooltip />} />
          <Bar dataKey="count" fill={INDIGO} radius={[0, 8, 8, 0]} maxBarSize={22} isAnimationActive={!reduced} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
