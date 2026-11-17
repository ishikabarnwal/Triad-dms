import { ArrowDown, ArrowUp, Info, Plus, Warning, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { createField, updateField } from "@/api/admin";
import { errorInfo, inputErrors } from "@/api/client";
import { inputType } from "@/utils/fields";
import { Button } from "../ui/button";
import { Dialog, DialogContent } from "../ui/dialog";
import { Input, NativeSelect } from "../ui/input";
import { Field, Label } from "../ui/label";
import { SegmentedControl } from "../ui/segmented";
import { Switch } from "../ui/switch";

export const TYPE_LABELS = { text: "Text", select: "Select", number: "Number", date: "Date" };
const TYPES = Object.entries(TYPE_LABELS).map(([value, label]) => ({ value, label }));
const OPTION_MAX = 100;
const FLAGS = [
  { name: "required", label: "Required", hint: "Uploads can't be saved without it." },
  { name: "filterable", label: "Filterable", hint: "Shows as a filter on the dashboard and in search." },
  { name: "searchable", label: "Searchable", hint: "Search matches its values." },
];
const EMPTY = { label: "", key: "", type: "text", options: [], required: false, filterable: true, searchable: true };

/** A key the API will accept, from a label: the same words, minus dots and a leading "$". */
export function suggestKey(label) {
  return label.trim().replace(/\./g, "").replace(/^\$+/, "");
}

/** Why the key and type (and for the built-in field, more) can't be edited, or null if they can. */
function lockReason(field) {
  if (!field) {
    return null;
  }
  if (field.locked) {
    return "This is a built-in field. Its key, type, options and required setting are fixed, because divisions depend on it.";
  }
  if (field.usage_count > 0) {
    const docs = field.usage_count === 1 ? "1 document uses" : `${field.usage_count} documents use`;
    return `${docs} this field, so its key and type can't change. Label, options and switches can.`;
  }
  return null;
}

/** Add, remove and reorder the choices of a select field. Blank and repeated options are refused. */
function OptionsEditor({ options, onChange, error, disabled }) {
  const [draft, setDraft] = useState("");
  const [problem, setProblem] = useState("");

  const add = () => {
    const text = draft.trim();
    if (!text) {
      setProblem("Type an option first.");
      return;
    }
    if (options.some((option) => option.toLowerCase() === text.toLowerCase())) {
      setProblem(`“${text}” is already in the list.`);
      return;
    }
    onChange([...options, text]);
    setDraft("");
    setProblem("");
  };

  const move = (index, step) => {
    const next = [...options];
    [next[index], next[index + step]] = [next[index + step], next[index]];
    onChange(next);
  };

  const message = problem || error;
  return (
    <div>
      <Label htmlFor="field-option-new">Options</Label>
      {options.length > 0 && (
        <ol className="mb-2 divide-y divide-line rounded-lg border border-line" aria-label="Options">
          {options.map((option, index) => (
            <li key={option} className="flex items-center gap-2 py-1.5 pr-1.5 pl-3 text-sm">
              <span className="w-5 text-xs text-muted tabular-nums">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate">{option}</span>
              <Button type="button" variant="ghost" size="iconSm" disabled={disabled || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${option} up`}>
                <ArrowUp className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                disabled={disabled || index === options.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Move ${option} down`}
              >
                <ArrowDown className="size-3.5" aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                disabled={disabled}
                onClick={() => onChange(options.filter((item) => item !== option))}
                aria-label={`Remove ${option}`}
              >
                <X className="size-3.5" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <Input
            id="field-option-new"
            value={draft}
            maxLength={OPTION_MAX}
            invalid={Boolean(message)}
            placeholder={options.length ? "Add another option" : "Add the first option"}
            onChange={(event) => {
              setDraft(event.target.value);
              setProblem("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={add}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        </div>
      )}
      {message && (
        <p className="mt-1.5 text-xs text-danger" role="alert">
          {message}
        </p>
      )}
    </div>
  );
}

/** How the field will look on the upload form, updated as the admin types. */
function UploadPreview({ form, divisionOptions }) {
  const options = form.source === "divisions" ? divisionOptions : form.options;
  const label = form.label.trim() || "Field label";
  return (
    <div className="self-start rounded-xl bg-lavender p-4">
      <p className="mb-3 text-xs font-semibold text-muted">Preview on the upload form</p>
      <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
        <Field label={label} htmlFor="field-preview" required={form.required}>
          {form.type === "select" ? (
            <NativeSelect id="field-preview" defaultValue="">
              <option value="">{form.required ? "Choose an option" : "Not set"}</option>
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </NativeSelect>
          ) : (
            <Input id="field-preview" type={inputType(form)} placeholder={form.type === "text" ? `Type the ${label.toLowerCase()}` : undefined} />
          )}
        </Field>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-muted">
        <li>{form.filterable ? "Also shown as a filter on the dashboard and in search." : "Not shown as a filter."}</li>
        <li>{form.searchable ? "Search matches its values." : "Search ignores its values."}</li>
      </ul>
    </div>
  );
}

/** Only what changed, so the API never sees an edit to a locked attribute that wasn't made. */
function changedAttributes(field, form) {
  const changes = {};
  ["label", "key", "type", "required", "filterable", "searchable"].forEach((name) => {
    if (form[name] !== field[name]) {
      changes[name] = form[name];
    }
  });
  if (!field.source && JSON.stringify(form.options) !== JSON.stringify(field.options)) {
    changes.options = form.options;
  }
  return changes;
}

/**
 * Add a metadata field, or edit one (`field` given). Backend validation errors (reserved words,
 * duplicate keys, a select without options) appear under the input they are about.
 */
export default function FieldDialog({ open, field, divisionOptions, onOpenChange, onSaved }) {
  const editing = Boolean(field);
  const [form, setForm] = useState(EMPTY);
  const [keyTouched, setKeyTouched] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(field ? { ...EMPTY, ...field, options: field.source ? [] : field.options } : EMPTY);
      setKeyTouched(editing);
      setErrors({});
      setFormError("");
      setBusy(false);
    }
  }, [open, field, editing]);

  const locked = lockReason(field);
  const keyLocked = Boolean(field?.locked || field?.usage_count > 0);
  const set = (name, value) => {
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: undefined }));
  };

  const setLabel = (value) => {
    setForm((current) => ({ ...current, label: value, key: keyTouched ? current.key : suggestKey(value) }));
    setErrors((current) => ({ ...current, label: undefined, key: keyTouched ? current.key : undefined }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const missing = {};
    if (!form.label.trim()) {
      missing.label = "Give the field a label.";
    }
    if (!form.key.trim()) {
      missing.key = "Give the field a key.";
    }
    if (form.type === "select" && !form.source && !form.options.length) {
      missing.options = "A select field needs at least one option.";
    }
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }
    setBusy(true);
    setFormError("");
    const body = { ...form, label: form.label.trim(), key: form.key.trim(), options: form.type === "select" ? form.options : [] };
    try {
      const response = editing ? await updateField(field.id, changedAttributes(field, body)) : await createField(body);
      onSaved(response.data, editing);
      onOpenChange(false);
    } catch (error) {
      const info = errorInfo(error);
      const placed = inputErrors(info);
      // Errors about one option ("options.2") belong to the options editor as a whole.
      Object.keys(placed).forEach((name) => {
        if (name.startsWith("options.")) {
          placed.options = placed[name];
        }
      });
      setErrors(placed);
      setFormError(Object.keys(placed).length ? "" : info.message);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        title={editing ? `Edit ${field.label}` : "Add field"}
        description={editing ? "Changes apply to the upload form and filters straight away." : "It appears on the upload form and filters straight away."}
        className="max-w-3xl"
        closable={!busy}
      >
        <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
          <div className="grid flex-1 gap-6 overflow-y-auto px-6 py-5 md:grid-cols-[minmax(0,1fr)_260px]">
            <div className="space-y-5">
              {formError && (
                <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-ink" role="alert">
                  <Warning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  {formError}
                </p>
              )}
              {locked && (
                <p className="flex items-start gap-2 rounded-lg bg-lavender px-4 py-3 text-sm leading-6 text-ink">
                  <Info className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {locked}
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Label" htmlFor="field-label" required error={errors.label} hint="What people see on forms.">
                  <Input id="field-label" value={form.label} maxLength={100} invalid={Boolean(errors.label)} onChange={(e) => setLabel(e.target.value)} />
                </Field>
                <Field
                  label="Key"
                  htmlFor="field-key"
                  required
                  error={errors.key}
                  hint={keyLocked ? "Locked." : "Stored on each document. Filled in from the label."}
                >
                  <Input
                    id="field-key"
                    value={form.key}
                    maxLength={100}
                    disabled={keyLocked}
                    invalid={Boolean(errors.key)}
                    onChange={(e) => {
                      setKeyTouched(true);
                      set("key", e.target.value);
                    }}
                  />
                </Field>
              </div>

              <div>
                <p className="mb-1.5 text-sm font-medium" aria-hidden="true">
                  Type
                </p>
                <SegmentedControl
                  options={TYPES}
                  value={form.type}
                  onChange={(value) => !keyLocked && set("type", value)}
                  label="Type"
                  className={keyLocked ? "pointer-events-none opacity-60" : undefined}
                />
                {errors.type && (
                  <p className="mt-1.5 text-xs text-danger" role="alert">
                    {errors.type}
                  </p>
                )}
              </div>

              {form.type === "select" &&
                (form.source === "divisions" ? (
                  <p className="text-sm text-muted">Options come from the divisions list. Manage them on the Divisions tab.</p>
                ) : (
                  <OptionsEditor options={form.options} onChange={(value) => set("options", value)} error={errors.options} disabled={field?.locked} />
                ))}

              <fieldset className="divide-y divide-line rounded-xl border border-line">
                <legend className="sr-only">Behaviour</legend>
                {FLAGS.map((flag) => {
                  const disabled = flag.name === "required" && field?.locked;
                  return (
                    <label key={flag.name} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3">
                      <span>
                        <span className="block text-sm font-semibold">{flag.label}</span>
                        <span className="block text-xs text-muted">{flag.hint}</span>
                      </span>
                      <Switch checked={form[flag.name]} disabled={disabled} onCheckedChange={(value) => set(flag.name, value)} aria-label={flag.label} />
                    </label>
                  );
                })}
              </fieldset>
            </div>

            <UploadPreview form={form} divisionOptions={divisionOptions} />
          </div>

          <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving" : editing ? "Save changes" : "Add field"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
