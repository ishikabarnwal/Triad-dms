import { flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { columnFields } from "@/utils/fields";
import { formatBytes, formatDate } from "@/utils/format";
import { AccessChip, Chip, DivisionChip, FileIcon, OcrChip } from "./Chips";
import { staggerItem } from "./motion";
import { Button } from "./ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Skeleton } from "./ui/skeleton";

const SKELETON_ROWS = 6;
const VISIBILITY_KEY = "triad_dms_columns";

/** Column visibility survives reloads in this browser (a convenience, so failures are ignored). */
function useStoredVisibility() {
  const [visibility, setVisibility] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(VISIBILITY_KEY)) || {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(VISIBILITY_KEY, JSON.stringify(visibility));
    } catch {
      // Storage blocked: the choice just won't be remembered.
    }
  }, [visibility]);
  return [visibility, setVisibility];
}

/** A metadata value rendered by its field type. */
function MetadataValue({ field, value }) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted/60">—</span>;
  }
  if (field.type === "date") {
    return <span className="font-mono text-xs text-muted">{formatDate(value)}</span>;
  }
  if (field.type === "select") {
    return <Chip tone="outline">{String(value)}</Chip>;
  }
  return <span className="text-sm">{String(value)}</span>;
}

function buildColumns(fields) {
  const metadata = columnFields(fields).map((field) => ({
    id: `meta:${field.key}`,
    header: field.label,
    // The server sorts by any active metadata key.
    meta: { sortKey: field.key },
    cell: ({ row }) => <MetadataValue field={field} value={row.original.metadata?.[field.key]} />,
  }));

  return [
    {
      id: "title",
      header: "Document",
      enableHiding: false,
      meta: { sortKey: "title" },
      cell: ({ row }) => (
        <div className="flex min-w-56 items-center gap-3">
          <FileIcon contentType={row.original.content_type} />
          <div className="min-w-0">
            <div className="max-w-72 truncate font-medium">{row.original.title}</div>
            <div className="font-mono text-[11px] text-muted">
              {row.original.content_type === "application/pdf" ? "PDF" : "IMG"} · {formatBytes(row.original.size)}
            </div>
          </div>
        </div>
      ),
    },
    { id: "division", header: "Division", cell: ({ row }) => <DivisionChip name={row.original.division} /> },
    ...metadata,
    { id: "ocr", header: "OCR", cell: ({ row }) => <OcrChip status={row.original.ocr_status} /> },
    {
      id: "created_at",
      header: "Uploaded",
      meta: { sortKey: "created_at" },
      cell: ({ row }) => (
        <span className="font-mono text-xs whitespace-nowrap text-muted">{formatDate(row.original.created_at)}</span>
      ),
    },
    { id: "access", header: "Access", cell: ({ row }) => <AccessChip status={row.original.access_status} /> },
  ];
}

function SortIcon({ direction }) {
  if (direction === "asc") {
    return <ArrowUp className="size-3" aria-hidden="true" />;
  }
  if (direction === "desc") {
    return <ArrowDown className="size-3" aria-hidden="true" />;
  }
  return <ChevronsUpDown className="size-3 opacity-40" aria-hidden="true" />;
}

/** Column visibility menu, placed by the parent next to the filters. */
export function ColumnsMenu({ table }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 className="size-4" aria-hidden="true" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        {table
          .getAllLeafColumns()
          .filter((column) => column.getCanHide())
          .map((column) => (
            <DropdownMenuCheckboxItem
              key={column.id}
              checked={column.getIsVisible()}
              onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
            >
              {column.columnDef.header}
            </DropdownMenuCheckboxItem>
          ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Select fields show by default; free-text, number and date fields start hidden to keep the table narrow. */
function defaultVisibility(fields) {
  return Object.fromEntries(
    columnFields(fields)
      .filter((field) => field.type !== "select")
      .map((field) => [`meta:${field.key}`, false]),
  );
}

/** TanStack table instance over server-side data; sorting itself happens in the API. */
export function useDocumentsTable({ documents, fields, sort, order }) {
  const [storedVisibility, setStoredVisibility] = useStoredVisibility();
  const columns = useMemo(() => buildColumns(fields), [fields]);
  const columnVisibility = useMemo(() => ({ ...defaultVisibility(fields), ...storedVisibility }), [fields, storedVisibility]);
  return useReactTable({
    data: documents,
    columns,
    state: { columnVisibility, sorting: [{ id: sort, desc: order === "desc" }] },
    onColumnVisibilityChange: (updater) =>
      setStoredVisibility(typeof updater === "function" ? updater(columnVisibility) : updater),
    manualSorting: true,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });
}

/** Clicking a sortable header calls onSortChange(sortKey, order) and the parent refetches. */
export default function DocumentsTable({ table, loading, sort, order, onSortChange }) {
  const navigate = useNavigate();
  const open = (id) => navigate(`/documents/${id}`);
  const headers = table.getHeaderGroups()[0].headers;

  const toggleSort = (sortKey) => {
    const nextOrder = sort === sortKey && order === "desc" ? "asc" : "desc";
    onSortChange(sortKey, nextOrder);
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line">
            {headers.map((header) => {
              const sortKey = header.column.columnDef.meta?.sortKey;
              const direction = sortKey && sort === sortKey ? order : null;
              const label = flexRender(header.column.columnDef.header, header.getContext());
              return (
                <th
                  key={header.id}
                  scope="col"
                  className="h-11 px-4 text-left whitespace-nowrap first:pl-5"
                  aria-sort={direction ? (direction === "asc" ? "ascending" : "descending") : undefined}
                >
                  {sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(sortKey)}
                      className={cn(
                        "label-mono inline-flex cursor-pointer items-center gap-1.5 hover:text-ink",
                        direction ? "text-ink" : "text-muted",
                      )}
                    >
                      {label}
                      <SortIcon direction={direction} />
                    </button>
                  ) : (
                    <span className="label-mono text-muted">{label}</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: SKELETON_ROWS }, (_, row) => (
                <tr key={row} className="border-b border-line/70 last:border-0">
                  {headers.map((header, column) => (
                    <td key={header.id} className="h-16 px-4 first:pl-5">
                      <Skeleton className={cn("h-3.5", column === 0 ? "w-48" : "w-16")} />
                    </td>
                  ))}
                </tr>
              ))
            : table.getRowModel().rows.map((row, index) => (
                <motion.tr
                  key={row.id}
                  {...staggerItem(index)}
                  tabIndex={0}
                  onClick={() => open(row.id)}
                  onKeyDown={(event) => event.key === "Enter" && open(row.id)}
                  aria-label={`Open ${row.original.title}`}
                  className="group cursor-pointer border-b border-line/70 transition-colors last:border-0 hover:bg-lavender/60 focus-visible:bg-lavender focus-visible:outline-none"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="h-16 px-4 first:pl-5 group-hover:first:shadow-[inset_2px_0_0_var(--color-primary)]"
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </motion.tr>
              ))}
        </tbody>
      </table>
    </div>
  );
}
