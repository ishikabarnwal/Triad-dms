import { CloudArrowUp, FileImage, FilePdf, Warning, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { errorInfo } from "@/api/client";
import { uploadDocument } from "@/api/documents";
import { useAuth } from "@/context/AuthContext";
import usePublicConfig from "@/hooks/usePublicConfig";
import { fileTypeLabels, listInWords } from "@/lib/limits";
import { cn } from "@/lib/utils";
import { inputType, isDivisionField } from "@/utils/fields";
import { fileStem, formatBytes } from "@/utils/format";
import { Button } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Input, NativeSelect } from "./ui/input";
import { Field } from "./ui/label";
import { Progress } from "./ui/progress";

// Browser MIME type for each extension the API may accept. The accepted list itself comes from the API.
const MIME_BY_EXTENSION = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  tif: "image/tiff",
  tiff: "image/tiff",
  bmp: "image/bmp",
  webp: "image/webp",
};

/** react-dropzone's accept map, e.g. { "image/jpeg": [".jpg", ".jpeg"] }, from the API's extensions. */
function acceptFor(extensions) {
  const accept = {};
  extensions.forEach((extension) => {
    const mime = MIME_BY_EXTENSION[extension];
    if (mime) {
      accept[mime] = [...(accept[mime] || []), `.${extension}`];
    }
  });
  return accept;
}

/** One metadata input, shaped by the field's type. */
function MetadataField({ field, value, error, locked, onChange }) {
  const id = `upload-${field.id}`;
  return (
    <Field label={field.label} htmlFor={id} required={field.required} error={error} hint={locked ? "Files are saved to your own division." : undefined}>
      {field.type === "select" ? (
        <NativeSelect id={id} value={value} invalid={Boolean(error)} disabled={locked} onChange={(e) => onChange(e.target.value)}>
          {(!field.required || !value) && <option value="">{field.required ? "Choose an option" : "Not set"}</option>}
          {field.options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </NativeSelect>
      ) : (
        <Input id={id} type={inputType(field)} value={value} invalid={Boolean(error)} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

/** A page with a scan line sweeping it while OCR runs on the server. */
function ExtractingState() {
  return (
    <div className="flex flex-col items-center px-6 pt-8 pb-14 text-center" role="status">
      <div className="relative mb-6 flex h-28 w-22 items-center justify-center overflow-hidden rounded-xl border border-line bg-lavender">
        <div className="w-12 space-y-1.5" aria-hidden="true">
          {[100, 80, 92, 64, 86, 72].map((width, index) => (
            <span key={index} className="block h-1 rounded-full bg-line" style={{ width: `${width}%` }} />
          ))}
        </div>
        <span className="absolute inset-x-0 h-0.5 animate-scan bg-primary" aria-hidden="true" />
      </div>
      <p className="text-lg font-bold tracking-[-0.02em]">Extracting text</p>
      <p className="mt-1.5 max-w-sm text-sm leading-6 text-muted">
        Reading the pages so the document can be found by the words inside it. This can take a moment for long scans.
      </p>
    </div>
  );
}

function initialValues(fields, user) {
  return Object.fromEntries(fields.map((field) => [field.key, isDivisionField(field) ? user.division : ""]));
}

/** Client side check for required fields, so obvious gaps don't need a round trip. */
function missingRequired(fields, values) {
  const errors = {};
  fields.forEach((field) => {
    if (field.required && !String(values[field.key] ?? "").trim()) {
      errors[field.key] = `${field.label} is required.`;
    }
  });
  return errors;
}

// API error codes about the file itself, so they belong under the drop zone.
const FILE_ERRORS = new Set(["file_required", "empty_file", "unsupported_file_type", "invalid_file", "file_too_large"]);
// Division errors arrive without a field name; they belong to whichever field holds the division.
const DIVISION_ERRORS = new Set(["division_forbidden", "unknown_division", "division_required"]);

/**
 * Decide where an upload error is shown: under the file, under a field, or at the top of the form.
 * Returns { fileError, fieldErrors, formError }.
 */
function placeUploadError(info, fields, maxMb) {
  if (FILE_ERRORS.has(info.code) || info.status === 413) {
    const message = info.status === 413 ? `That file is larger than ${maxMb} MB.` : info.message;
    return { fileError: message, fieldErrors: {}, formError: "" };
  }
  const divisionField = fields.find(isDivisionField);
  if (DIVISION_ERRORS.has(info.code) && divisionField) {
    return { fileError: "", fieldErrors: { [divisionField.key]: info.message }, formError: "" };
  }
  const shown = new Set(["title", ...fields.map((field) => field.key)]);
  const placed = Object.keys(info.fieldErrors).some((key) => shown.has(key));
  return { fileError: "", fieldErrors: info.fieldErrors, formError: placed ? "" : info.message };
}

/** Calm confirmation with a way straight to the new document. */
function announce(document, openDocument) {
  const action = { label: "View document", onClick: () => openDocument(document.id) };
  if (document.ocr_status === "failed") {
    toast("Uploaded. Text could not be read from this file.", {
      description: `${document.title} is in ${document.division} and can be found by its title and details.`,
      action,
    });
    return;
  }
  let description = "Text extraction is turned off, so its text wasn't read.";
  if (document.ocr_status === "done") {
    description = document.page_count === 1 ? "Text read from 1 page." : `Text read from ${document.page_count} pages.`;
  }
  toast.success(`${document.title} uploaded to ${document.division}.`, { description, action });
}

export default function UploadModal({ open, fields, onOpenChange, onUploaded }) {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const config = usePublicConfig();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [fileError, setFileError] = useState("");
  const [phase, setPhase] = useState("form");
  const [progress, setProgress] = useState(0);

  const accept = useMemo(() => acceptFor(config.extensions || []), [config.extensions]);
  const formats = listInWords(fileTypeLabels(config.file_types), "or");
  const limits = `${formats}, up to ${config.max_upload_mb} MB`;

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle("");
      setValues(initialValues(fields, user));
      setErrors({});
      setFormError("");
      setFileError("");
      setPhase("form");
      setProgress(0);
    }
  }, [open, fields, user]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept,
    maxSize: config.max_upload_mb * 1024 * 1024,
    multiple: false,
    disabled: phase !== "form",
    onDrop: (accepted, rejected) => {
      if (rejected.length) {
        const tooBig = rejected[0].errors.some((e) => e.code === "file-too-large");
        setFileError(tooBig ? `That file is larger than ${config.max_upload_mb} MB.` : `That type isn't supported. Use ${formats}.`);
        return;
      }
      setFile(accepted[0]);
      setFileError("");
      setTitle((current) => current || fileStem(accepted[0].name));
    },
  });

  const setValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const busy = phase !== "form";

  const submit = async (event) => {
    event.preventDefault();
    if (!file) {
      setFileError("Choose a file to upload.");
      return;
    }
    const missing = missingRequired(fields, values);
    if (Object.keys(missing).length) {
      setErrors(missing);
      return;
    }
    const metadata = Object.fromEntries(Object.entries(values).filter(([, value]) => String(value ?? "").trim() !== ""));
    setPhase("uploading");
    setFormError("");
    setFileError("");
    try {
      const response = await uploadDocument({ file, title: title.trim(), metadata }, (percent) => {
        setProgress(percent);
        if (percent >= 100) {
          setPhase("extracting");
        }
      });
      announce(response.data, (id) => navigate(`/documents/${id}`));
      onUploaded(response.data);
      onOpenChange(false);
    } catch (error) {
      const placed = placeUploadError(errorInfo(error), fields, config.max_upload_mb);
      setErrors(placed.fieldErrors);
      setFileError(placed.fileError);
      setFormError(placed.formError);
      setPhase("form");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        title={phase === "extracting" ? "Almost done" : "Upload document"}
        description={phase === "extracting" ? undefined : `${limits}. Text is read automatically.`}
        className="max-w-2xl"
        closable={!busy}
        onInteractOutside={(event) => busy && event.preventDefault()}
      >
        {phase === "extracting" ? (
          <ExtractingState />
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {formError && (
                <p className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-ink" role="alert">
                  <Warning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden="true" />
                  {formError}
                </p>
              )}

              <div>
                {file ? (
                  <div className={cn("flex items-center gap-3 rounded-xl border p-3", fileError ? "border-danger" : "border-line")}>
                    <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {file.type === "application/pdf" ? <FilePdf className="size-5" aria-hidden="true" /> : <FileImage className="size-5" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{file.name}</p>
                      <p className="text-xs text-muted">{formatBytes(file.size)}</p>
                    </div>
                    {!busy && (
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setFileError("");
                        }}
                        className="cursor-pointer rounded-lg p-2 text-muted hover:bg-lavender hover:text-ink"
                        aria-label="Remove file"
                      >
                        <X className="size-4" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div
                    {...getRootProps({
                      className: cn(
                        "flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                        isDragReject || fileError ? "border-danger bg-danger/5" : isDragActive ? "border-primary bg-primary/5" : "border-primary/30 bg-lavender/60 hover:border-primary/60 hover:bg-lavender",
                      ),
                    })}
                  >
                    <input {...getInputProps()} />
                    <span className="mb-3 flex size-12 items-center justify-center rounded-xl bg-white text-primary shadow-soft">
                      <CloudArrowUp className="size-6" aria-hidden="true" />
                    </span>
                    <p className="font-semibold">{isDragActive ? "Drop to upload" : "Drag a file here, or click to browse"}</p>
                    <p className="mt-1.5 text-sm text-muted">{limits}</p>
                  </div>
                )}
                {fileError && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-danger" role="alert">
                    <Warning className="size-3.5 shrink-0" aria-hidden="true" />
                    {fileError}
                  </p>
                )}
              </div>

              {phase === "uploading" && (
                <div>
                  <div className="mb-2 flex justify-between text-sm text-muted">
                    <span>Uploading</span>
                    <span className="tabular-nums">{progress}%</span>
                  </div>
                  <Progress value={progress} label="Upload progress" />
                </div>
              )}

              <Field label="Title" htmlFor="upload-title" hint="Starts as the file name." error={errors.title}>
                <Input
                  id="upload-title"
                  value={title}
                  maxLength={200}
                  disabled={busy}
                  invalid={Boolean(errors.title)}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setErrors((current) => ({ ...current, title: undefined }));
                  }}
                />
              </Field>

              <fieldset>
                <legend className="mb-3 text-sm font-bold">Details</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  {fields.map((field) => (
                    <MetadataField
                      key={field.id}
                      field={field}
                      value={values[field.key] ?? ""}
                      error={errors[field.key]}
                      locked={isDivisionField(field) && !isAdmin}
                      onChange={(value) => setValue(field.key, value)}
                    />
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !file}>
                {busy ? "Uploading" : "Upload"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
