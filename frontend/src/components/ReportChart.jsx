import { useReducedMotion } from "framer-motion";
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { NOT_SET } from "@/utils/format";
import { Skeleton } from "./ui/skeleton";

const INDIGO = "#605BE5";
const INK = "#111111";
const MUTED = "#6B6B80";
const LAVENDER = "#F3F2FD";
const FONT = "Manrope Variable, sans-serif";

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) {
    return null;
  }
  const count = payload[0].value;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs shadow-soft">
      <p className="font-semibold">{label}</p>
      <p className="text-muted">
        {count} {count === 1 ? "document" : "documents"}
      </p>
    </div>
  );
}

/**
 * Documents per option of one select field, from /api/stats `by_group`. Horizontal bars with the
 * count printed at the end of each, so no axis or grid lines are needed.
 */
export default function ReportChart({ group, loading }) {
  const reduced = useReducedMotion();

  if (loading) {
    return <Skeleton className="h-52 w-full rounded-xl" />;
  }
  if (!group) {
    return <p className="text-sm text-muted">Add a select field in Settings to see a breakdown here.</p>;
  }

  const data = group.counts.map((row) => ({ name: row.value ?? NOT_SET, count: row.count }));
  const summary = data.map((row) => `${row.name}: ${row.count}`).join(", ");
  // Fills whatever height its card has, but never squeezes a bar below a readable size.
  return (
    <div className="h-full w-full" style={{ minHeight: data.length * 36 }} role="img" aria-label={`Documents by ${group.field}. ${summary}`}>
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 36, left: 0, bottom: 0 }} barCategoryGap={10}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={112}
            tickLine={false}
            axisLine={false}
            tick={{ fill: INK, fontSize: 13, fontFamily: FONT }}
          />
          <Tooltip cursor={{ fill: LAVENDER }} isAnimationActive={false} content={<ChartTooltip />} />
          <Bar
            dataKey="count"
            fill={INDIGO}
            radius={[0, 6, 6, 0]}
            maxBarSize={24}
            isAnimationActive={!reduced}
            background={{ fill: LAVENDER, radius: 6 }}
          >
            <LabelList dataKey="count" position="right" offset={10} style={{ fill: MUTED, fontSize: 12, fontFamily: FONT, fontWeight: 600 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
