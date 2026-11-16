import { Badge, Table } from "react-bootstrap";
import { useNavigate } from "react-router-dom";
import { columnFields } from "../utils/fields";
import { formatDate } from "../utils/format";
import { AccessBadge, DivisionBadge, FileIcon, OcrBadge } from "./Badges";

const SKELETON_ROWS = 6;

/** A metadata value rendered by its field type: dates formatted, select values as soft pills. */
function MetadataValue({ field, value }) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-soft">—</span>;
  }
  if (field.type === "date") {
    return <span className="text-nowrap">{formatDate(value)}</span>;
  }
  if (field.type === "select") {
    return (
      <Badge bg="" pill className="badge-value">
        {String(value)}
      </Badge>
    );
  }
  return <span>{String(value)}</span>;
}

function SkeletonRows({ columns }) {
  return Array.from({ length: SKELETON_ROWS }, (_, row) => (
    <tr key={row} aria-hidden="true">
      {Array.from({ length: columns }, (__, column) => (
        <td key={column}>
          <span className="skeleton" style={{ width: column === 0 ? "80%" : "60%" }} />
        </td>
      ))}
    </tr>
  ));
}

/** Documents with dynamic metadata columns. Clicking a row opens the document. */
export default function DocumentsTable({ documents, fields, loading }) {
  const navigate = useNavigate();
  const metadataColumns = columnFields(fields);
  const columnCount = 5 + metadataColumns.length;

  const open = (id) => navigate(`/documents/${id}`);

  return (
    <div className="table-responsive">
      <Table hover className="documents-table">
        <thead>
          <tr>
            <th scope="col">Document</th>
            <th scope="col">Division</th>
            {metadataColumns.map((field) => (
              <th scope="col" key={field.id}>
                {field.label}
              </th>
            ))}
            <th scope="col">OCR</th>
            <th scope="col">Uploaded</th>
            <th scope="col">Access</th>
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <SkeletonRows columns={columnCount} />
          ) : (
            documents.map((doc) => (
              <tr
                key={doc.id}
                tabIndex={0}
                onClick={() => open(doc.id)}
                onKeyDown={(event) => event.key === "Enter" && open(doc.id)}
                aria-label={`Open ${doc.title}`}
              >
                <td style={{ minWidth: 220 }}>
                  <div className="d-flex align-items-center gap-3">
                    <FileIcon contentType={doc.content_type} />
                    <div style={{ minWidth: 0 }}>
                      <div className="doc-title text-truncate" style={{ maxWidth: 280 }}>
                        {doc.title}
                      </div>
                      <div className="small text-muted-soft text-truncate" style={{ maxWidth: 280 }}>
                        {doc.filename}
                      </div>
                    </div>
                  </div>
                </td>
                <td>
                  <DivisionBadge name={doc.division} />
                </td>
                {metadataColumns.map((field) => (
                  <td key={field.id}>
                    <MetadataValue field={field} value={doc.metadata?.[field.key]} />
                  </td>
                ))}
                <td>
                  <OcrBadge status={doc.ocr_status} />
                </td>
                <td className="text-nowrap text-muted-soft">{formatDate(doc.created_at)}</td>
                <td>
                  <AccessBadge status={doc.access_status} />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </Table>
    </div>
  );
}
