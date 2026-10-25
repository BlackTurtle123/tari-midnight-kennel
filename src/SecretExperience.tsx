import { Check, Eye, Globe, LockKeyhole, Mail, RefreshCw } from "lucide-react";
import { DOORS, type IncubationView } from "../shared/game";

export function SecretExperience({
  incubation,
  busy,
  onOpen,
  onResume,
}: {
  incubation?: IncubationView;
  busy: boolean;
  onOpen: () => void;
  onResume: () => void;
}) {
  const stage = incubation?.stage;
  const ready = stage === "ready";
  const publishing = stage === "hatching";
  const sealed = ["sealed", "delivering", "ready", "hatching"].includes(
    stage ?? "",
  );
  const delivered = ready || publishing;
  const title = !incubation
    ? "Which canine? That’s the secret."
    : ready
      ? "A secret is waiting in your wallet."
      : publishing
        ? "Your secret is becoming a canine NFT."
        : stage === "reserved"
          ? "Preparing a place for your secret…"
          : sealed
            ? "Delivering your secret, encrypted…"
            : "Sealing your canine’s identity…";
  return (
    <section
      className={`secret-experience${ready ? " secret-ready" : ""}`}
      aria-label="Your secret canine"
    >
      <div className="secret-envelope" aria-hidden="true">
        {publishing ? (
          <Globe size={48} />
        ) : (
          <Mail size={68} strokeWidth={1.1} />
        )}
        {!publishing && (
          <span className="envelope-seal">
            <LockKeyhole size={20} />
          </span>
        )}
        <span className="envelope-caption">
          {publishing ? "REVEAL IN PROGRESS" : "SEALED SURPRISE"}
        </span>
      </div>
      <div className="secret-body">
        <div className="eyebrow">
          {incubation
            ? DOORS[incubation.door].name
            : "A SPOOKY SECRET, DELIVERED BY TARI"}
        </div>
        <h3 aria-live={incubation ? "polite" : undefined}>{title}</h3>
        <p className="secret-description">
          {!incubation
            ? "Your canine, genes, colour and trick-or-treat result stay hidden from public view. Tari delivers the surprise to your wallet in an encrypted message."
            : ready
              ? "Open the encrypted message to meet your canine. Looking doesn’t mint an NFT or reveal the result to the public."
              : publishing
                ? "You chose to reveal. Tari is checking the sealed outcome and minting your canine with public traits."
                : "The surprise stays hidden from public view while we seal the outcome and send an encrypted message to your wallet."}
        </p>
        {!publishing && (
          <div className="hidden-traits" aria-label="Hidden traits">
            {["Canine", "Genes", "Colour", "Trick or treat"].map((label) => (
              <span key={label}>
                <LockKeyhole size={12} />
                {label}
                <b aria-hidden="true">?</b>
              </span>
            ))}
          </div>
        )}
        {incubation && (
          <ol className="secret-progress" aria-label="Secret delivery progress">
            {[
              { label: "Outcome sealed", done: sealed, current: !sealed },
              {
                label: "Encrypted message delivered",
                done: delivered,
                current: sealed && !delivered,
              },
              {
                label: publishing
                  ? "Publishing your NFT"
                  : "You choose when to reveal",
                done: false,
                current: publishing,
              },
            ].map((step, index) => (
              <li
                key={index}
                className={step.done ? "done" : step.current ? "current" : ""}
                aria-current={step.current ? "step" : undefined}
              >
                <span>
                  {step.done ? (
                    <Check size={13} aria-label="Complete" />
                  ) : (
                    index + 1
                  )}
                </span>
                {step.label}
              </li>
            ))}
          </ol>
        )}
        {incubation?.error && (
          <p className="inline-error" role="alert">
            {incubation.error}
          </p>
        )}
        {incubation ? (
          <div className="secret-actions">
            <button
              className={ready ? "primary" : "secondary"}
              disabled={busy}
              onClick={ready ? onOpen : onResume}
            >
              {ready ? <Eye size={17} /> : <RefreshCw size={16} />}
              {ready ? "Open privately" : "Check progress"}
            </button>
            {ready && <span>No public reveal. No NFT minted yet.</span>}
          </div>
        ) : (
          <p className="secret-choice">
            <Eye size={16} /> Peek privately first. Reveal and mint only when
            you choose.
          </p>
        )}
        <p className="secret-boundary">
          Hidden from public view until you reveal. The game operator knows the
          result. Your wallet keys stay in Sapient. Opening asks permission to
          read private wallet memos and balances; you can revoke that permission
          in Sapient.
        </p>
        {incubation && (
          <details className="secret-proof">
            <summary>Incubation receipt</summary>
            <p>
              The sealed fingerprint lets Tari check that the canine you mint
              matches the original surprise.
            </p>
            <dl>
              <dt>Incubation</dt>
              <dd>{incubation.id}</dd>
              <dt>
                {sealed
                  ? "Sealed fingerprint"
                  : "Fingerprint awaiting confirmation"}
              </dt>
              <dd>{incubation.commitment}</dd>
              <dt>Progress</dt>
              <dd>{incubation.stage}</dd>
            </dl>
          </details>
        )}
      </div>
    </section>
  );
}
