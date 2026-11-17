import { ArrowDown, ArrowUp, CaretDown, DotsSixVertical, PencilSimple, Plus, Trash, Warning } from "@phosphor-icons/react";
import { Reorder, useDragControls } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { deleteField, listFields, reorderFields, updateField } from "@/api/admin";
import { errorInfo } from "@/api/client";
import { invalidateMetadataFields } from "@/hooks/useMetadataFields";
import { cn } from "@/lib/utils";
import { Chip } from "../Chips";
import ConfirmDialog from "../ConfirmDialog";
import EmptyState from "../EmptyState";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { Switch } from "../ui/switch";
import { Tooltip } from "../ui/tooltip";
import FieldDialog, { TYPE_LABELS } from "./FieldDialog";

const SWITCHES = [
  { name: "required", label: "Required" },
  { name: "filterable", label: "Filterable" },
  { name: "searchable", label: "Searchable" },
];

function optionSummary(field) {
  if (field.type !== "select") {
    return null;
  }
  if (field.source === "divisions") {
    return "Options from divisions";
  }
  return field.options.length === 1 ? "1 option" : `${field.options.length} options`;
}

function usageLine(field) {
  if (!field.usage_count) {
    return "Not used yet";
  }
  return field.usage_count === 1 ? "Used by 1 document" : `Used by ${field.usage_count} documents`;
}

/** One active field: drag handle, move buttons, what it is, its three switches and its actions. */
function FieldRow({ field, index, count, onMove, onDragEnd, onToggle, onEdit, onDelete }) {
  const controls = useDragControls();
  const summary = optionSummary(field);

  return (
    <Reorder.Item
      value={field}
      dragListener={false}
      dragControls={controls}
      onDragEnd={onDragEnd}
      className="relative flex flex-col gap-4 bg-white px-4 py-4 sm:px-5 lg:flex-row lg:items-center"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onPointerDown={(event) => controls.start(event)}
            className="hidden cursor-grab touch-none rounded-md p-1.5 text-muted hover:bg-lavender hover:text-ink active:cursor-grabbing sm:block"
            aria-hidden="true"
            tabIndex={-1}
          >
            <DotsSixVertical className="size-5" weight="bold" />
          </button>
          <div className="flex flex-col">
            <button
              type="button"
              disabled={index === 0}
              onClick={() => onMove(index, -1)}
              className="cursor-pointer rounded p-0.5 text-muted hover:bg-lavender hover:text-ink disabled:cursor-default disabled:opacity-30"
              aria-label={`Move ${field.label} up`}
            >
              <ArrowUp className="size-3.5" aria-hidden="true" />
            </button>
            <button
              type="button"
              disabled={index === count - 1}
              onClick={() => onMove(index, 1)}
              className="cursor-pointer rounded p-0.5 text-muted hover:bg-lavender hover:text-ink disabled:cursor-default disabled:opacity-30"
              aria-label={`Move ${field.label} down`}
            >
              <ArrowDown className="size-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold">{field.label}</p>
            <Chip tone="outline">{TYPE_LABELS[field.type]}</Chip>
            {field.locked && <Chip tone="primary">System field</Chip>}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            Key: {field.key}
            {summary && ` · ${summary}`} · {usageLine(field)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 pl-10 lg:pl-0">
        {SWITCHES.map((item) => {
          const disabled = item.name === "required" && field.locked;
          const control = (
            <label className={cn("flex items-center gap-2 text-sm", disabled ? "text-muted" : "cursor-pointer")}>
              <Switch checked={field[item.name]} disabled={disabled} onCheckedChange={(value) => onToggle(field, item.name, value)} />
              {item.label}
            </label>
          );
          return disabled ? (
            <Tooltip key={item.name} content="Divisions always need a value, so this stays on.">
              <span tabIndex={0} className="rounded-md">
                {control}
              </span>
            </Tooltip>
          ) : (
            <span key={item.name}>{control}</span>
          );
        })}
        <div className="flex gap-1">
          <Button variant="ghost" size="iconSm" onClick={() => onEdit(field)} aria-label={`Edit ${field.label}`}>
            <PencilSimple className="size-4" aria-hidden="true" />
          </Button>
          {field.locked ? (
            <Tooltip content="Built in, so it can't be deleted.">
              <span tabIndex={0} className="rounded-lg">
                <Button variant="ghost" size="iconSm" disabled aria-label={`${field.label} can't be deleted`}>
                  <Trash className="size-4" aria-hidden="true" />
                </Button>
              </span>
            </Tooltip>
          ) : (
            <Button variant="ghost" size="iconSm" onClick={() => onDelete(field)} aria-label={`Delete ${field.label}`}>
              <Trash className="size-4" aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}

/** Deleted fields, folded away, each with Restore. */
function HiddenFields({ fields, onRestore }) {
  const [open, setOpen] = useState(false);
  if (!fields.length) {
    return null;
  }
  return (
    <section className="card mt-6 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <span>
          <span className="block font-semibold">Hidden fields ({fields.length})</span>
          <span className="block text-sm text-muted">Not on forms or filters. Documents keep their values.</span>
        </span>
        <CaretDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul className="divide-y divide-line border-t border-line">
          {fields.map((field) => (
            <li key={field.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-ink/80">{field.label}</p>
                <p className="text-xs text-muted">
                  Key: {field.key} · {TYPE_LABELS[field.type]} · {usageLine(field)}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onRestore(field)}>
                Restore
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Metadata fields: order, switches, add, edit, hide and restore. */
export default function FieldsTab() {
  const [fields, setFields] = useState([]);
  const [state, setState] = useState({ loading: true, error: "" });
  const [dialog, setDialog] = useState({ open: false, field: null });
  const [deleting, setDeleting] = useState(null);
  // The order before a drag started, so a failed save can put it back.
  const orderBefore = useRef(null);

  const load = useCallback(() => {
    setState({ loading: true, error: "" });
    listFields()
      .then((response) => {
        setFields(response.data.fields);
        setState({ loading: false, error: "" });
      })
      .catch((error) => setState({ loading: false, error: errorInfo(error).message }));
  }, []);

  useEffect(load, [load]);

  const active = fields.filter((field) => field.active).sort((a, b) => a.order - b.order);
  const hidden = fields.filter((field) => !field.active);
  const divisionOptions = fields.find((field) => field.source === "divisions")?.options || [];

  /** Other screens cache the fields; after any change they should fetch them again. */
  const changed = () => invalidateMetadataFields();

  const replaceField = (saved) => setFields((current) => current.map((item) => (item.id === saved.id ? saved : item)));

  const saveOrder = async (ordered, previous) => {
    try {
      const response = await reorderFields(ordered.map((field) => field.id));
      setFields(response.data.fields);
      changed();
      toast.success("Field order saved");
    } catch (error) {
      setFields(previous);
      toast.error(errorInfo(error).message);
    }
  };

  /** Give the active fields new order numbers locally, keeping the hidden ones as they are. */
  const withOrder = (ordered) => [...ordered.map((field, index) => ({ ...field, order: index })), ...hidden];

  const move = (index, step) => {
    const previous = fields;
    const ordered = [...active];
    [ordered[index], ordered[index + step]] = [ordered[index + step], ordered[index]];
    setFields(withOrder(ordered));
    saveOrder(ordered, previous);
  };

  const onReorder = (ordered) => {
    if (!orderBefore.current) {
      orderBefore.current = { fields, ids: active.map((field) => field.id).join() };
    }
    setFields(withOrder(ordered));
  };

  const onDragEnd = () => {
    const before = orderBefore.current;
    orderBefore.current = null;
    if (before && before.ids !== active.map((field) => field.id).join()) {
      saveOrder(active, before.fields);
    }
  };

  const toggle = async (field, name, value) => {
    replaceField({ ...field, [name]: value });
    try {
      const response = await updateField(field.id, { [name]: value });
      replaceField(response.data);
      changed();
      toast.success(`${field.label} is ${value ? "now" : "no longer"} ${name}`);
    } catch (error) {
      replaceField(field);
      toast.error(errorInfo(error).message);
    }
  };

  const restore = async (field) => {
    try {
      const response = await updateField(field.id, { active: true });
      replaceField(response.data);
      changed();
      toast.success(`${field.label} is back on forms and filters`);
    } catch (error) {
      toast.error(errorInfo(error).message);
    }
  };

  const remove = async () => {
    const response = await deleteField(deleting.id);
    replaceField(response.data);
    changed();
    toast.success(`${deleting.label} hidden`, { description: "Existing documents keep their values. Restore it any time below." });
  };

  const saved = (field, editing) => {
    setFields((current) => (editing ? current.map((item) => (item.id === field.id ? field : item)) : [...current, field]));
    changed();
    toast.success(editing ? `${field.label} saved` : `${field.label} added`, {
      description: editing ? undefined : "It's on the upload form and filters now.",
    });
  };

  let body;
  if (state.loading) {
    body = (
      <div className="card divide-y divide-line" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-4 px-5 py-5">
            <Skeleton className="size-6 rounded-md" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="hidden h-5 w-72 md:block" />
          </div>
        ))}
      </div>
    );
  } else if (state.error) {
    body = (
      <div className="card">
        <EmptyState
          Icon={Warning}
          title="Couldn't load the fields"
          message={state.error}
          action={
            <Button variant="outline" onClick={load}>
              Try again
            </Button>
          }
        />
      </div>
    );
  } else {
    body = (
      <>
        <Reorder.Group axis="y" values={active} onReorder={onReorder} className="card divide-y divide-line overflow-hidden" aria-label="Active fields">
          {active.map((field, index) => (
            <FieldRow
              key={field.id}
              field={field}
              index={index}
              count={active.length}
              onMove={move}
              onDragEnd={onDragEnd}
              onToggle={toggle}
              onEdit={(item) => setDialog({ open: true, field: item })}
              onDelete={setDeleting}
            />
          ))}
        </Reorder.Group>
        <HiddenFields fields={hidden} onRestore={restore} />
      </>
    );
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <p className="max-w-xl text-sm leading-6 text-muted">
          These fields appear on the upload form, the filters and the document page. Changes apply immediately.
        </p>
        <Button onClick={() => setDialog({ open: true, field: null })} disabled={state.loading || Boolean(state.error)}>
          <Plus className="size-4" weight="bold" aria-hidden="true" />
          Add field
        </Button>
      </div>

      {body}

      <FieldDialog
        open={dialog.open}
        field={dialog.field}
        divisionOptions={divisionOptions}
        onOpenChange={(open) => setDialog((current) => ({ ...current, open }))}
        onSaved={saved}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleting ? `Hide ${deleting.label}?` : "Hide field"}
        description="It disappears from the upload form and the filters straight away."
        confirmLabel="Hide field"
        busyLabel="Hiding"
        onConfirm={remove}
      >
        {deleting && (
          <p className="rounded-xl bg-lavender p-4 text-sm leading-6">
            {deleting.usage_count
              ? `${usageLine(deleting)}. Those documents keep their ${deleting.label} values, and you can restore the field later from Hidden fields.`
              : "No documents use it yet. You can restore it later from Hidden fields."}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}
