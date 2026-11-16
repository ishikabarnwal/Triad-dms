import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const INDIGO = "#605BE5";
const MUTED = "#6B6B80";
const LINE = "#ECEAF7";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  return (
    <div className="surface px-3 py-2 small">
      <div className="fw-medium">{label}</div>
      <div className="text-muted-soft">
        {payload[0].value} {payload[0].value === 1 ? "document" : "documents"}
      </div>
    </div>
  );
}

/** Documents per option of one select field, from /api/stats `by_group`. */
export default function ReportChart({ group, loading }) {
  const reduced = useReducedMotion();

  if (loading) {
    return <span className="skeleton w-100" style={{ height: 220 }} />;
  }
  if (!group) {
    return <p className="text-muted-soft small mb-3">Add a select field in Settings to see a breakdown here.</p>;
  }

  const data = group.counts.map((row) => ({ name: row.value ?? "Not set", count: row.count }));
  // Horizontal bars leave room for long option names.
  const height = Math.max(180, data.length * 40);
  return (
    <div style={{ width: "100%", height }} role="img" aria-label={`Bar chart of documents by ${group.field}`}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={LINE} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: MUTED, fontSize: 12 }} />
          <YAxis
            type="category"
            dataKey="name"
            width={104}
            tickLine={false}
            axisLine={false}
            tick={{ fill: "#111111", fontSize: 12 }}
          />
          <Tooltip cursor={{ fill: "#F3F2FD" }} content={<ChartTooltip />} />
          <Bar dataKey="count" fill={INDIGO} radius={[0, 8, 8, 0]} maxBarSize={22} isAnimationActive={!reduced} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
