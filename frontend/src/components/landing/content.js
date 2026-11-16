import { ClipboardList, KeyRound, ScanSearch, Settings2, ShieldCheck, SlidersHorizontal } from "lucide-react";

// Everything here describes what the system really does; numbers match the backend defaults.

export const FEATURES = [
  {
    Icon: SlidersHorizontal,
    title: "Dynamic metadata",
    text: "Admins define fields like Report Type or Classification. Upload forms and filters update at once.",
    stat: "4 field types",
  },
  {
    Icon: ShieldCheck,
    title: "Division isolation",
    text: "People open files from their own division only. Everything else is locked by default.",
    stat: "Locked by default",
  },
  {
    Icon: KeyRound,
    title: "Cross-division access requests",
    text: "Ask the owning division for one specific file. They approve for a set number of days, or reject.",
    stat: "Up to 365-day expiry",
    dark: true,
  },
  {
    Icon: ScanSearch,
    title: "OCR text search",
    text: "Scanned PDFs and images are read with Tesseract, so the words inside them can be searched.",
    stat: "6 file formats",
  },
  {
    Icon: ClipboardList,
    title: "Audit trail",
    text: "Uploads, downloads, approvals, rejections and failed logins are recorded with who, when and where.",
    stat: "Every action",
  },
  {
    Icon: Settings2,
    title: "Admin control",
    text: "Add divisions, edit fields and change user roles from one Settings page.",
    stat: "Super admin only",
  },
];

export const STEPS = [
  { title: "Upload", text: "Drop a PDF or image and fill in the metadata. It's filed under your division." },
  { title: "OCR reads it", text: "Text is extracted in seconds, so the document can be found by what it says." },
  { title: "Request access", text: "Other divisions see the title and metadata, and can ask for the file." },
  { title: "Approve & download", text: "The owner approves, with an optional expiry. Access can be revoked at any time." },
];

export const SECURITY_POINTS = [
  { title: "Division isolation", text: "Files, previews and OCR text are only served to the owning division." },
  { title: "Expiring access", text: "Approvals can end after 7 or 30 days, or any length up to a year." },
  { title: "Instant revocation", text: "The owner can withdraw access; the file locks on the next request." },
  { title: "Rate-limited login", text: "Repeated failed sign-ins from one address are slowed down." },
  { title: "Audit logs", text: "Every sensitive action is written down, including the ones that were refused." },
];

export const NUMBERS = [
  { value: 6, label: "File formats supported", detail: "PDF, PNG, JPG, TIFF, BMP, WEBP" },
  { value: 25, suffix: " MB", label: "Maximum file size", detail: "Per upload, configurable" },
  { value: 25, label: "Scanned pages OCR'd", detail: "Per upload, configurable" },
  { value: 100, suffix: "%", label: "Sensitive actions logged", detail: "Uploads, downloads, decisions" },
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
