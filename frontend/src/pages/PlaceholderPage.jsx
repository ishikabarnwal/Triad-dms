import EmptyState from "@/components/EmptyState";
import PageHeader from "@/components/PageHeader";
import useDocumentTitle from "@/hooks/useDocumentTitle";

/** Temporary page for sections built in the next part of the frontend. */
export default function PlaceholderPage({ title, Icon }) {
  useDocumentTitle(title);
  return (
    <>
      <PageHeader title={title} subtitle="This part of the workspace is being built next." />
      <div className="card">
        <EmptyState Icon={Icon} title={`${title} is on its way`} message="It arrives in the next frontend update." />
      </div>
    </>
  );
}
