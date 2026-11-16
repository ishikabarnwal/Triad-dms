import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";

/** Temporary page for sections built in the next part of the frontend. */
export default function PlaceholderPage({ title, code, Icon }) {
  return (
    <>
      <PageHeader code={code} title={title} />
      <div className="card">
        <EmptyState Icon={Icon} code="STATUS: IN PROGRESS" title={`${title} is on its way`} message="This section is part of the next frontend update." />
      </div>
    </>
  );
}
