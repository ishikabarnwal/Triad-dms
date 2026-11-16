// Everything here describes what the system really does; numbers match the backend defaults
// (MAX_UPLOAD_MB=25, OCR_MAX_PAGES=25, six accepted file formats).

export const NAV_SECTIONS = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "security", label: "Security" },
  { id: "faq", label: "FAQ" },
];

export const MARQUEE = [
  "PDF",
  "PNG",
  "JPG",
  "TIFF",
  "BMP",
  "WEBP",
  "OCR · TESSERACT 5",
  "PYMUPDF",
  "RBAC",
  "DIVISION ISOLATION",
  "GRIDFS",
  "MONGODB",
  "JWT",
  "BCRYPT",
  "AUDIT LOG",
  "RATE LIMITING",
  "EXPIRING ACCESS",
  "FULL-TEXT SEARCH",
];

export const PIPELINE = [
  { code: "IN.01", title: "Upload", detail: "PDF or image, type checked from content" },
  { code: "OCR.02", title: "OCR engine", detail: "PyMuPDF text layer, Tesseract for scans" },
  { code: "DB.03", title: "MongoDB / GridFS", detail: "File in GridFS, metadata in MongoDB" },
  { code: "IDX.04", title: "Search index", detail: "Text index plus partial-word matching" },
  { code: "OUT.05", title: "Authorised user", detail: "Division or approved request only" },
];

export const STEPS = [
  {
    number: "01",
    title: "Upload",
    text: "Drop a PDF or image and fill in the metadata your admin defined. It's filed under your division automatically.",
  },
  {
    number: "02",
    title: "OCR reads it",
    text: "The text layer is read directly; scanned pages go through Tesseract. The document becomes searchable by what it says.",
  },
  {
    number: "03",
    title: "Request access",
    text: "Other divisions see the title and metadata, never the contents. One click asks the owning division for the file.",
  },
  {
    number: "04",
    title: "Approve & download",
    text: "The owner approves for 7 or 30 days, or rejects. Access can be revoked at any time, and every step is logged.",
  },
];

export const SECURITY_FACTS = [
  { code: "SEC.01", title: "Division isolation", text: "Files, previews and OCR text are served to the owning division only." },
  { code: "SEC.02", title: "Expiring access", text: "Approvals can end after a set number of days, up to a year." },
  { code: "SEC.03", title: "Revocation", text: "The owner can withdraw access. The file locks on the next request." },
  { code: "SEC.04", title: "Rate-limited login", text: "Repeated failed sign-ins from one address are slowed down." },
  { code: "SEC.05", title: "Audit trail", text: "Uploads, downloads, decisions and refusals are all recorded." },
  { code: "SEC.06", title: "Content-type verification", text: "File types are read from the bytes, not trusted from the name." },
];

export const NUMBERS = [
  { value: 6, label: "File formats", detail: "PDF PNG JPG TIFF BMP WEBP" },
  { value: 25, suffix: " MB", label: "Max file size", detail: "Per upload, configurable" },
  { value: 25, label: "Pages OCR'd", detail: "Scanned pages per upload" },
  { value: 100, suffix: "%", label: "Actions logged", detail: "Uploads, downloads, decisions" },
];

export const FAQS = [
  {
    question: "Who can see a document?",
    answer:
      "Everyone in the division that uploaded it, plus the system administrator. Other divisions can see its title and metadata, so they know it exists, but they can't open the file or read its text.",
  },
  {
    question: "How does an access request work?",
    answer:
      "Open the document and click Request access, with an optional reason. Anyone in the owning division can approve or reject it. An approval can be given for a limited number of days.",
  },
  {
    question: "Can access be taken back?",
    answer:
      "Yes. The owning division can revoke an approval at any time and the file is locked again straight away. Approvals that reach their expiry date lock automatically.",
  },
  {
    question: "Which file types can I upload?",
    answer:
      "PDF, PNG, JPG, TIFF, BMP and WEBP, up to 25 MB each. The type is checked from the file's content, not just its name.",
  },
  {
    question: "How does search work?",
    answer:
      "Search covers titles, metadata and the text read by OCR, including partial words. For documents you can't open, only the title and metadata are searched, so results never reveal what a restricted file says.",
  },
  {
    question: "What if OCR can't read a file?",
    answer:
      "The document is still saved and can be downloaded as normal. It's marked as OCR failed and can still be found by its title and metadata.",
  },
];
