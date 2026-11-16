import { ChevronDown, ChevronUp, Filter, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Col, Collapse, Form, Row } from "react-bootstrap";
import { inputType } from "../utils/fields";

const TYPING_DELAY_MS = 400;

/** A free-text filter that only updates the URL once the user pauses typing. */
function TextFilter({ field, value, onChange }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => setDraft(value), [value]);

  useEffect(() => {
    if (draft === value) {
      return undefined;
    }
    const timer = setTimeout(() => onChange(draft), TYPING_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, value, onChange]);

  return (
    <Form.Control
      type={inputType(field)}
      size="sm"
      value={draft}
      placeholder={`Any ${field.label.toLowerCase()}`}
      onChange={(event) => setDraft(event.target.value)}
    />
  );
}

function FilterControl({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <Form.Select size="sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">All</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Form.Select>
    );
  }
  if (field.type === "date") {
    return <Form.Control type="date" size="sm" value={value} onChange={(event) => onChange(event.target.value)} />;
  }
  return <TextFilter field={field} value={value} onChange={onChange} />;
}

/**
 * Filters built from the admin-defined metadata fields (only those marked filterable).
 * `values` maps field key -> current value; `onChange(key, value)` updates one filter.
 */
export default function FilterBar({ fields, values, onChange, onClear, loading }) {
  const [open, setOpen] = useState(false);
  const filterable = fields.filter((field) => field.filterable);
  const activeCount = filterable.filter((field) => values[field.key]).length;

  if (loading) {
    return (
      <div className="surface filter-bar mb-3">
        <span className="skeleton" style={{ width: "60%" }} />
      </div>
    );
  }
  if (!filterable.length) {
    return null;
  }

  return (
    <div className="surface filter-bar mb-3">
      <Button
        variant="link"
        className="d-md-none p-0 w-100 d-flex align-items-center justify-content-between text-reset"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="filter-fields"
      >
        <span className="fw-medium d-inline-flex align-items-center gap-2">
          <Filter size={16} className="text-primary" aria-hidden="true" />
          Filters
          {activeCount > 0 && <span className="pill pill-solid">{activeCount}</span>}
        </span>
        {open ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
      </Button>
      <Collapse in={open}>
        <div id="filter-fields" className="filter-fields">
          <Row className="g-3 align-items-end pt-3 pt-md-0">
            {filterable.map((field) => (
              <Col key={field.id} xs={12} sm={6} md={4} xl={3} xxl={2}>
                <Form.Group controlId={`filter-${field.id}`}>
                  <Form.Label>{field.label}</Form.Label>
                  <FilterControl
                    field={field}
                    value={values[field.key] || ""}
                    onChange={(value) => onChange(field.key, value)}
                  />
                </Form.Group>
              </Col>
            ))}
            <Col xs="auto">
              <Button variant="light" size="sm" onClick={onClear} disabled={!activeCount}>
                <X size={14} aria-hidden="true" />
                Clear filters
              </Button>
            </Col>
          </Row>
        </div>
      </Collapse>
    </div>
  );
}
