import EmptyState from "../components/EmptyState";
import PageHeader from "../components/PageHeader";

/** Temporary page for sections built in the next part of the frontend. */
export default function PlaceholderPage({ title, Icon }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="surface">
        <EmptyState Icon={Icon} title={`${title} is on its way`} message="This section is part of the next frontend update." />
      </div>
    </>
  );
}
