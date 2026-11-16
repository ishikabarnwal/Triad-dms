import { FileImage, FileText, UploadCloud, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { errorInfo } from "@/api/client";
import { uploadDocument } from "@/api/documents";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";
import { inputType, isDivisionField } from "@/utils/fields";
import { fileStem, formatBytes } from "@/utils/format";
import ScrambleText from "./ScrambleText";
import { Button, ButtonArrow } from "./ui/button";
import { Dialog, DialogContent } from "./ui/dialog";
import { Input, NativeSelect } from "./ui/input";
import { Field } from "./ui/label";
import { Progress } from "./ui/progress";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tif", ".tiff"],
  "image/bmp": [".bmp"],
  "image/webp": [".webp"],
};
const SCAN_WORDS = ["READING PAGES", "EXTRACTING TEXT", "INDEXING FOR SEARCH"];
const SCAN_WORD_MS = 1400;

/** One metadata input, shaped by the field's type. */
function MetadataField({ field, value, error, locked, onChange }) {
  const id = `upload-${field.id}`;
  return (
    <Field
      label={field.label}
      htmlFor={id}
      required={field.required}
      error={error}
      hint={locked ? "Filed under your own division." : undefined}
    >
      {field.type === "select" ? (
        <NativeSelect id={id} value={value} invalid={Boolean(error)} disabled={locked} onChange={(e) => onChange(e.target.value)}>
          {(!field.required || !value) && <option value="">{field.required ? "Choose…" : "Not set"}</option>}
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

/** Dashed border drawn in SVG so it can march while a file is dragged over. */
function DropBorder({ active, rejected }) {
  return (
    <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
      <rect
        x="0.75"
        y="0.75"
        rx="19"
        style={{ width: "calc(100% - 1.5px)", height: "calc(100% - 1.5px)" }}
        fill="none"
        strokeWidth="1.5"
        strokeDasharray="7 7"
        className={cn(
          "transition-colors",
          rejected ? "stroke-danger" : active ? "stroke-primary" : "stroke-muted/40",
          active && "animate-[march_0.6s_linear_infinite]",
        )}
      />
    </svg>
  );
}

/** Scan line sweeping a document while the status text decrypts. */
function ScanningState() {
  const [word, setWord] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setWord((current) => (current + 1) % SCAN_WORDS.length), SCAN_WORD_MS);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center" role="status">
      <div className="relative mb-6 flex h-28 w-22 items-center justify-center overflow-hidden rounded-xl border border-line bg-lavender">
        <div className="w-12 space-y-1.5" aria-hidden="true">
          {[100, 80, 92, 64, 86, 72].map((width, index) => (
            <span key={index} className="block h-1 rounded-full bg-line" style={{ width: `${width}%` }} />
          ))}
        </div>
        <span className="absolute inset-x-0 h-0.5 animate-scan bg-primary" aria-hidden="true" />
      </div>
      <ScrambleText key={word} text={SCAN_WORDS[word]} className="label-mono text-primary" />
      <p className="mt-2 text-sm text-muted">Running OCR so the document can be searched by what it says.</p>
    </div>
  );
}

function initialValues(fields, user) {
  return Object.fromEntries(fields.map((field) => [field.key, isDivisionField(field) ? user.division : ""]));
}

/** Client-side check for required fields, so obvious gaps don't need a round trip. */
function missingRequired(fields, values) {
  const errors = {};
  fields.forEach((field) => {
    if (field.required && !String(values[field.key] ?? "").trim()) {
      errors[field.key] = `${field.label} is required.`;
    }
  });
  return errors;
}

function ocrMessage(document) {
  if (document.ocr_status === "done") {
    const pages = document.page_count === 1 ? "1 page" : `${document.page_count} pages`;
    return `Text extracted from ${pages}. It's now searchable.`;
  }
  if (document.ocr_status === "failed") {
    return `Saved, but text could not be extracted (${document.ocr_error || "unreadable file"}).`;
  }
  return "Saved without text extraction.";
}

export default function UploadModal({ open, fields, onOpenChange, onUploaded }) {
  const { user, isAdmin } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [phase, setPhase] = useState("form");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (open) {
      setFile(null);
      setTitle("");
      setValues(initialValues(fields, user));
      setErrors({});
      setFormError("");
      setPhase("form");
      setProgress(0);
    }
  }, [open, fields, user]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    disabled: phase !== "form",
    onDrop: (accepted, rejected) => {
      if (rejected.length) {
        const tooBig = rejected[0].errors.some((e) => e.code === "file-too-large");
        setFormError(tooBig ? "That file is larger than 25 MB." : "Only PDF and image files (PNG, JPG, TIFF, BMP, WEBP).");
        return;
      }
      setFile(accepted[0]);
      setFormError("");
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
      setFormError("Choose a file to upload.");
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
    try {
      const response = await uploadDocument({ file, title: title.trim(), metadata }, (percent) => {
        setProgress(percent);
        if (percent >= 100) {
          setPhase("scanning");
        }
      });
      const document = response.data;
      const notify = document.ocr_status === "failed" ? toast.error : toast.success;
      notify(`"${document.title}" uploaded`, { description: ocrMessage(document) });
      onUploaded(document);
      onOpenChange(false);
    } catch (error) {
      const info = errorInfo(error);
      setErrors(info.fieldErrors);
      setFormError(info.message);
      setPhase("form");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent
        title="Upload document"
        description={phase === "scanning" ? undefined : "PDF or image, up to 25 MB. Text is extracted automatically."}
        className="max-w-2xl"
        onInteractOutside={(event) => busy && event.preventDefault()}
      >
        {phase === "scanning" ? (
          <ScanningState />
        ) : (
          <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {formError && (
                <div className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">
                  {formError}
                </div>
              )}

              {file ? (
                <div className="flex items-center gap-3 rounded-2xl border border-line p-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    {file.type === "application/pdf" ? <FileText className="size-5" /> : <FileImage className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{file.name}</div>
                    <div className="font-mono text-[11px] text-muted uppercase">{formatBytes(file.size)}</div>
                  </div>
                  {!busy && (
                    <button type="button" onClick={() => setFile(null)} className="rounded-full p-2 text-muted hover:bg-lavender" aria-label="Remove file">
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ) : (
                <div
                  {...getRootProps({
                    className: cn(
                      "relative flex cursor-pointer flex-col items-center rounded-[20px] px-6 py-10 text-center transition-colors focus:outline-none focus-visible:ring-4 focus-visible:ring-primary/20",
                      isDragActive ? "bg-primary/5" : "bg-lavender/60 hover:bg-lavender",
                    ),
                  })}
                >
                  <input {...getInputProps()} />
                  <DropBorder active={isDragActive} rejected={isDragReject} />
                  <span className="mb-3 flex size-12 items-center justify-center rounded-2xl border border-line bg-white text-primary">
                    <UploadCloud className="size-5" aria-hidden="true" />
                  </span>
                  <div className="font-medium">{isDragActive ? "Drop to upload" : "Drag a file here, or click to browse"}</div>
                  <div className="label-mono mt-2 text-muted">PDF · PNG · JPG · TIFF · BMP · WEBP — 25 MB</div>
                </div>
              )}

              {phase === "uploading" && (
                <div>
                  <div className="label-mono mb-2 flex justify-between text-muted">
                    <span>Uploading</span>
                    <span>{progress}%</span>
                  </div>
                  <Progress value={progress} label="Upload progress" />
                </div>
              )}

              <Field label="Title" htmlFor="upload-title" hint="Defaults to the file name.">
                <Input id="upload-title" value={title} maxLength={200} disabled={busy} onChange={(e) => setTitle(e.target.value)} />
              </Field>

              <div>
                <div className="label-mono mb-3 text-muted">Metadata</div>
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
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !file}>
                {busy ? "Uploading…" : "Upload"}
                {!busy && <ButtonArrow />}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
