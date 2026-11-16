import { ArrowRight, CloudUpload, FileImage, FileText, ScanText, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, Button, Col, Form, Modal, ProgressBar, Row } from "react-bootstrap";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import { errorInfo } from "../api/client";
import { uploadDocument } from "../api/documents";
import { useAuth } from "../context/AuthContext";
import { inputType, isDivisionField } from "../utils/fields";
import { fileStem, formatBytes } from "../utils/format";

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ACCEPTED_TYPES = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/tiff": [".tif", ".tiff"],
  "image/bmp": [".bmp"],
  "image/webp": [".webp"],
};

/** One metadata input, shaped by the field's type. */
function MetadataField({ field, value, error, locked, onChange }) {
  const label = (
    <Form.Label>
      {field.label}
      {field.required && <span className="text-danger ms-1">*</span>}
    </Form.Label>
  );

  let control;
  if (field.type === "select") {
    control = (
      <Form.Select value={value} isInvalid={Boolean(error)} disabled={locked} onChange={(e) => onChange(e.target.value)}>
        {!field.required && <option value="">Not set</option>}
        {field.required && !value && <option value="">Choose…</option>}
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Form.Select>
    );
  } else {
    control = (
      <Form.Control
        type={inputType(field)}
        value={value}
        isInvalid={Boolean(error)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <Form.Group controlId={`upload-${field.id}`}>
      {label}
      {control}
      {locked && <Form.Text className="text-muted-soft">Documents are filed under your own division.</Form.Text>}
      <Form.Control.Feedback type="invalid">{error}</Form.Control.Feedback>
    </Form.Group>
  );
}

function initialValues(fields, user) {
  const values = {};
  fields.forEach((field) => {
    values[field.key] = isDivisionField(field) ? user.division : "";
  });
  return values;
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

export default function UploadModal({ show, fields, onHide, onUploaded }) {
  const { user, isAdmin } = useAuth();
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [values, setValues] = useState({});
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [phase, setPhase] = useState("form");
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (show) {
      setFile(null);
      setTitle("");
      setValues(initialValues(fields, user));
      setErrors({});
      setFormError("");
      setPhase("form");
      setProgress(0);
    }
  }, [show, fields, user]);

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    accept: ACCEPTED_TYPES,
    maxSize: MAX_UPLOAD_BYTES,
    multiple: false,
    disabled: phase !== "form",
    onDrop: (accepted, rejected) => {
      if (rejected.length) {
        const tooBig = rejected[0].errors.some((e) => e.code === "file-too-large");
        setFormError(tooBig ? "That file is larger than 25 MB." : "Only PDF and image files (PNG, JPG, TIFF, BMP, WEBP) can be uploaded.");
        return;
      }
      const chosen = accepted[0];
      setFile(chosen);
      setFormError("");
      setTitle((current) => current || fileStem(chosen.name));
    },
  });

  const setValue = (key, value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

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
      onHide();
    } catch (error) {
      const info = errorInfo(error);
      setErrors(info.fieldErrors);
      setFormError(info.message);
      setPhase("form");
    }
  };

  const busy = phase !== "form";

  return (
    <Modal show={show} onHide={busy ? undefined : onHide} size="lg" centered backdrop={busy ? "static" : true}>
      <Form onSubmit={submit} noValidate>
        <Modal.Header closeButton={!busy}>
          <Modal.Title as="h2" className="h4 heading-tight">
            Upload document
          </Modal.Title>
        </Modal.Header>

        <Modal.Body className="px-4">
          {phase === "scanning" ? (
            <div className="scan-state">
              <span className="icon-tile" style={{ width: "3.75rem", height: "3.75rem" }}>
                <ScanText size={28} aria-hidden="true" />
              </span>
              <h3 className="h6 mt-3 mb-1">Scanning document (OCR)…</h3>
              <p className="text-muted-soft small mb-0">Extracting text so it can be searched. This can take a few seconds.</p>
            </div>
          ) : (
            <>
              {formError && <Alert variant="danger">{formError}</Alert>}

              {file ? (
                <div className="selected-file mb-4">
                  <span className="icon-tile sm">
                    {file.type === "application/pdf" ? <FileText size={18} aria-hidden="true" /> : <FileImage size={18} aria-hidden="true" />}
                  </span>
                  <div className="flex-grow-1" style={{ minWidth: 0 }}>
                    <div className="fw-medium text-truncate">{file.name}</div>
                    <div className="small text-muted-soft">{formatBytes(file.size)}</div>
                  </div>
                  {!busy && (
                    <Button variant="link" className="text-muted-soft" onClick={() => setFile(null)} aria-label="Remove file">
                      <X size={18} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  {...getRootProps({
                    className: `dropzone mb-4 ${isDragActive ? "is-active" : ""} ${isDragReject ? "is-rejected" : ""}`,
                  })}
                >
                  <input {...getInputProps()} />
                  <CloudUpload size={34} className="text-primary" aria-hidden="true" />
                  <div className="fw-medium mt-2">{isDragActive ? "Drop the file here" : "Drag a file here, or click to browse"}</div>
                  <div className="small text-muted-soft mt-1">PDF, PNG, JPG, TIFF, BMP or WEBP · up to 25 MB</div>
                </div>
              )}

              {phase === "uploading" && <ProgressBar now={progress} label={`${progress}%`} className="mb-4" />}

              <Form.Group className="mb-4" controlId="upload-title">
                <Form.Label>Title</Form.Label>
                <Form.Control
                  value={title}
                  maxLength={200}
                  disabled={busy}
                  placeholder="Defaults to the file name"
                  onChange={(e) => setTitle(e.target.value)}
                />
              </Form.Group>

              <h3 className="h6 text-muted-soft text-uppercase small mb-3" style={{ letterSpacing: "0.05em" }}>
                Metadata
              </h3>
              <Row className="g-3">
                {fields.map((field) => (
                  <Col md={6} key={field.id}>
                    <MetadataField
                      field={field}
                      value={values[field.key] ?? ""}
                      error={errors[field.key]}
                      locked={isDivisionField(field) && !isAdmin}
                      onChange={(value) => setValue(field.key, value)}
                    />
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Modal.Body>

        <Modal.Footer className="px-4">
          <Button variant="light" onClick={onHide} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload"}
            {!busy && <ArrowRight size={16} className="btn-arrow" aria-hidden="true" />}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}
