// Everything here describes what the system really does. Limits shown as numbers are read live
// from GET /api/config/public; the demo names inside the mini visuals are sample content.

export const NAV_SECTIONS = [
  { id: "features", label: "Features" },
  { id: "how-it-works", label: "How it works" },
  { id: "security", label: "Security" },
  { id: "faq", label: "FAQ" },
];

export const PIPELINE = [
  { title: "Upload", detail: "PDF or image, type checked from its content" },
  { title: "OCR", detail: "Text layer read first, Tesseract for scans" },
  { title: "Storage", detail: "File in GridFS, details in MongoDB" },
  { title: "Search index", detail: "Titles, metadata and page text" },
  { title: "Authorised user", detail: "Own division or an approved request" },
];

export const STEPS = [
  {
    title: "Upload",
    text: "Drop a PDF or image and fill in the fields your admin set up. It's filed under your division.",
  },
  {
    title: "OCR reads it",
    text: "Scanned pages are read by OCR, so the document can be found by the words inside it.",
  },
  {
    title: "Request access",
    text: "Other divisions see the title and details, never the contents, and can ask the owners for the file.",
  },
  {
    title: "Approve and download",
    text: "The owners approve for a set number of days or reject. They can revoke access at any time.",
  },
];

export const SECURITY_FACTS = [
  { icon: "lock", title: "Division isolation", text: "Files, previews and page text open for the owning division only." },
  { icon: "timer", title: "Expiring access", text: "Approvals can end after a set number of days, up to a year." },
  { icon: "undo", title: "Revocation", text: "Owners can withdraw access, and the file locks straight away." },
  { icon: "gauge", title: "Rate limited sign in", text: "Repeated failed sign ins from one address are slowed down." },
  { icon: "list", title: "Audit trail", text: "Uploads, downloads, decisions and refusals are all recorded." },
  { icon: "scan", title: "File type checks", text: "A file's type is read from its bytes, not trusted from its name." },
];

export const FAQS = [
  {
    question: "Who can see a document?",
    answer:
      "Everyone in the division that uploaded it, plus the system administrator. Other divisions can see its title and details, so they know it exists, but they can't open the file or read its text.",
  },
  {
    question: "How does an access request work?",
    answer:
      "Open the document and choose Request access, with an optional reason. Anyone in the owning division can approve or reject it, and an approval can be limited to a number of days.",
  },
  {
    question: "Can access be taken back?",
    answer:
      "Yes. The owning division can revoke an approval at any time and the file locks again straight away. Approvals that reach their end date lock by themselves.",
  },
  {
    question: "Which file types can I upload?",
    // Built from the live config, so the answer always matches what the API accepts.
    answer: ({ formats, maxUploadMb }) =>
      `${formats}, up to ${maxUploadMb} MB each. The type is checked from the file's content, not just its name.`,
  },
  {
    question: "How does search work?",
    answer:
      "Search covers titles, details and the text read by OCR, including partial words. For documents you can't open, only the title and details are searched, so results never reveal what a restricted file says.",
  },
  {
    question: "What if OCR can't read a file?",
    answer:
      "The document is still saved and can be downloaded as normal. It's marked as unread and can still be found by its title and details.",
  },
];
