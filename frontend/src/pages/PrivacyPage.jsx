import LegalDocument from "@/components/LegalDocument";
import PageShell from "@/components/landing/PageShell";
import useDocumentTitle from "@/hooks/useDocumentTitle";
import usePublicConfig from "@/hooks/usePublicConfig";

const UPDATED = "17 November 2026";

export default function PrivacyPage() {
  useDocumentTitle("Privacy");
  const config = usePublicConfig();
  const sessionHours = Math.round(config.session_minutes / 60);

  const sections = [
    {
      heading: "What it stores",
      body: [
        "Your account: your name, email address, optional username, division and role. Your password is never stored, only a bcrypt hash of it.",
        "Your documents: the file itself, its title and details, and the text that OCR read from it.",
        "Access requests: who asked for which document, the reason they gave, and the decision.",
        "The audit log: uploads, downloads, decisions and failed sign ins, with the time, the person, their division and the IP address the request came from.",
      ],
    },
    {
      heading: "Where it is kept",
      body: [
        "Everything is kept in the MongoDB database of the server this prototype runs on. Files are stored in GridFS inside that database, not on the server's disk.",
        "Nothing is sent to outside services. There are no analytics, no advertising trackers and no third party cookies. Fonts are served from the same server.",
      ],
    },
    {
      heading: "What is kept in your browser",
      body: [
        `When you sign in, a session token is saved in your browser's local storage so you stay signed in for up to ${sessionHours} hours. Signing out removes it. The documents table also remembers which columns you chose to show.`,
      ],
    },
    {
      heading: "Who can see it",
      body: [
        "People in your division can open your division's documents. Other divisions can see a document's title and details, but not the file or its text, unless your division approves their request.",
        "The system administrator can see all documents, all divisions and the audit log.",
      ],
    },
    {
      heading: "How long it is kept",
      body: ["Data stays until an administrator deletes it. Because this is a prototype, the whole database may be reset at any time."],
    },
    {
      heading: "Contact",
      body: [
        "Triad AI Pvt. Ltd., Plot No. 76, Survey No. 252, Malkapoor Village, Chevella Mandal, Telangana 501503. Website: triad-ai.com.",
      ],
    },
  ];

  return (
    <PageShell>
      <LegalDocument
        eyebrow="Privacy"
        title="What Triad DMS keeps, and why"
        updated={UPDATED}
        intro="Triad DMS is a prototype built for Triad AI Pvt. Ltd. to show how a document system for defence divisions could work. This page lists what it stores about you and your files. Please don't upload real classified material or personal documents to it."
        sections={sections}
      />
    </PageShell>
  );
}
