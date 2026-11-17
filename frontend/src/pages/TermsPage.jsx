import LegalDocument from "@/components/LegalDocument";
import PageShell from "@/components/landing/PageShell";
import useDocumentTitle from "@/hooks/useDocumentTitle";

const SECTIONS = [
  {
    heading: "What this is",
    body: [
      "Triad DMS is a prototype built for Triad AI Pvt. Ltd. for evaluation. It is not a production service and is not approved for real defence documents.",
    ],
  },
  {
    heading: "Using it",
    body: [
      "Only upload files you are allowed to share, and never real classified material or other people's personal data.",
      "Open other divisions' documents only through an access request. Don't try to get around the access rules, guess other accounts' passwords, or overload the system.",
    ],
  },
  {
    heading: "Activity is recorded",
    body: [
      "Uploads, downloads, access decisions and failed sign ins are written to an audit log with your name, division, the time and your IP address. The administrator can read it.",
    ],
  },
  {
    heading: "Your account",
    body: [
      "Keep your password to yourself. Accounts can be removed, and the database can be reset at any time, so keep your own copy of anything you upload.",
    ],
  },
  {
    heading: "No warranty",
    body: ["The prototype is provided as it is. There is no promise that it will be available, free of errors, or that stored data will be kept."],
  },
  {
    heading: "Changes and contact",
    body: ["These terms may change; the date at the top shows the latest version. Questions go to Triad AI Pvt. Ltd. through triad-ai.com."],
  },
];

export default function TermsPage() {
  useDocumentTitle("Terms");
  return (
    <PageShell>
      <LegalDocument
        eyebrow="Terms"
        title="Terms of use"
        updated="17 November 2026"
        intro="These short terms cover how this prototype may be used. By creating an account you agree to them."
        sections={SECTIONS}
      />
    </PageShell>
  );
}
