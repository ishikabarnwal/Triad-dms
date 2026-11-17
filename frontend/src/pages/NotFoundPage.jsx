import { Link } from "react-router-dom";
import IsoVault from "@/components/landing/IsoVault";
import PageShell from "@/components/landing/PageShell";
import { Button, ButtonArrow } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import useDocumentTitle from "@/hooks/useDocumentTitle";

/** Branded 404 for any address that doesn't match a page. */
export default function NotFoundPage() {
  useDocumentTitle("Page not found");
  const { user } = useAuth();
  return (
    <PageShell>
      <div className="mx-auto flex max-w-xl flex-col items-center px-5 text-center">
        <IsoVault className="h-auto w-full max-w-[320px]" />
        <p className="mt-8 text-sm font-semibold text-primary">Error 404</p>
        <h1 className="mt-3 text-4xl font-bold tracking-[-0.03em] text-balance sm:text-5xl">This page isn&apos;t on file.</h1>
        <p className="mt-4 max-w-md text-lg leading-[1.6] text-balance text-muted">
          The address may be mistyped, or the page may have moved.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/">
              Go to the homepage <ButtonArrow />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to={user ? "/dashboard" : "/login"}>{user ? "Open dashboard" : "Sign in"}</Link>
          </Button>
        </div>
      </div>
    </PageShell>
  );
}
