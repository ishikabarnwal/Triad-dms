import { Check, ClockCounterClockwise, Hourglass, Key, Lock, Prohibit, XCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { formatDate, timeAgo } from "@/utils/format";
import { Button } from "../ui/button";

/** timeAgo for use mid sentence: "just now", "2 hours ago", or "on 16 Nov 2026" once it's a plain date. */
function sinceLower(value) {
  const text = timeAgo(value);
  if (text === "Just now") {
    return "just now";
  }
  return text.endsWith("ago") ? text : `on ${text}`;
}

/** Title, explanation, note and button for each state the viewer can be in without access. */
function describe(document) {
  const request = document.access_request || {};
  const division = document.division;
  switch (document.access_status) {
    case "pending":
      return {
        Icon: Hourglass,
        title: `Waiting for ${division} to review`,
        body: `Requested ${sinceLower(request.created_at)}. You'll be able to open the file here as soon as it is approved.`,
        note: request.reason ? { label: "Your reason", text: request.reason } : null,
      };
    case "rejected":
      return {
        Icon: XCircle,
        title: `${division} declined your request`,
        body: `Reviewed by ${request.decided_by_name || division} ${sinceLower(request.decided_at)}. You can ask again if things have changed.`,
        note: { label: "Reviewer's note", text: request.decision_note || "No note was left." },
        again: true,
      };
    case "expired":
      return {
        Icon: ClockCounterClockwise,
        title: "Your access has ended",
        body: `Access ended on ${formatDate(request.expires_at)}. Ask again if you still need this file.`,
        again: true,
      };
    case "revoked":
      return {
        Icon: Prohibit,
        title: "Your access was revoked",
        body: `${request.revoked_by_name || division} withdrew it ${sinceLower(request.revoked_at)}. Ask again if you still need this file.`,
        note: request.revoke_note ? { label: "Reason given", text: request.revoke_note } : null,
        again: true,
      };
    default:
      return {
        Icon: Lock,
        title: `This file belongs to ${division}`,
        body: `Send an access request and someone in ${division} will review it. Once approved, you can preview, download and read its text here.`,
      };
  }
}

/** The three steps of a request, with the current one marked. Shown while a request is pending. */
function RequestSteps({ division }) {
  const steps = [
    { label: "Request sent", state: "done" },
    { label: `${division} reviews`, state: "current" },
    { label: "File opens", state: "next" },
  ];
  return (
    <ol className="mt-7 flex w-full max-w-md items-start" aria-label="Request progress">
      {steps.map((step, index) => (
        <li key={step.label} className="relative flex flex-1 flex-col items-center text-center">
          {index > 0 && (
            // Runs from the previous step's dot to this one; the dots sit on top of its ends.
            <span
              aria-hidden="true"
              className={cn("absolute top-3.5 right-1/2 h-0.5 w-full -translate-y-1/2", step.state === "next" ? "bg-line" : "bg-primary")}
            />
          )}
          <span
            className={cn(
              "relative z-10 flex size-7 items-center justify-center rounded-full border-2 bg-white",
              step.state === "done" && "border-primary bg-primary text-white",
              step.state === "current" && "border-primary text-primary",
              step.state === "next" && "border-line text-muted",
            )}
          >
            {step.state === "done" ? (
              <Check className="size-3.5" weight="bold" aria-hidden="true" />
            ) : (
              <span className={cn("size-2 rounded-full", step.state === "current" ? "bg-primary" : "bg-line")} aria-hidden="true" />
            )}
          </span>
          <span className={cn("mt-2 px-1 text-xs font-semibold", step.state === "next" ? "text-muted" : "text-ink")}>
            {step.label}
            <span className="sr-only">{step.state === "done" ? ", done" : step.state === "current" ? ", in progress" : ", next"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** A page with its lines hidden, and the state icon resting on it. Flat shapes only. */
function HiddenPage({ Icon }) {
  return (
    <div className="relative mb-7" aria-hidden="true">
      <div className="h-32 w-26 space-y-2 rounded-lg border border-line bg-white p-4 shadow-soft">
        {[100, 84, 92, 60, 88, 72].map((width, index) => (
          <span key={index} className="block h-1.5 rounded-full bg-line" style={{ width: `${width}%` }} />
        ))}
      </div>
      <span className="absolute -right-5 -bottom-4 flex size-12 items-center justify-center rounded-xl bg-primary text-white shadow-lift">
        <Icon className="size-6" aria-hidden="true" />
      </span>
    </div>
  );
}

/** Shown in place of the preview when the viewer can't open the file. */
export default function LockedPanel({ document, onRequest }) {
  const state = describe(document);
  const canAsk = document.can_request_access;

  return (
    <section aria-labelledby="locked-title" className="card p-4 sm:p-5">
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl bg-lavender px-6 py-12 text-center lg:min-h-[560px]">
        <HiddenPage Icon={state.Icon} />
        <h2 id="locked-title" className="max-w-md text-xl font-bold tracking-[-0.02em] text-balance">
          {state.title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-pretty text-muted">{state.body}</p>

        {state.note && (
          <figure className="mt-5 w-full max-w-md rounded-xl border border-line bg-white p-4 text-left">
            <figcaption className="text-xs font-semibold text-muted">{state.note.label}</figcaption>
            <blockquote className="mt-1 text-sm leading-6 text-pretty break-words">{state.note.text}</blockquote>
          </figure>
        )}

        {document.access_status === "pending" && <RequestSteps division={document.division} />}

        {canAsk && (
          <Button className="mt-6" onClick={onRequest}>
            <Key className="size-4" aria-hidden="true" />
            {state.again ? "Request again" : "Request access"}
          </Button>
        )}
      </div>
    </section>
  );
}
