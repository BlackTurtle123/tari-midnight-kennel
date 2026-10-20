import { useState } from "react";
import { GitMerge, ArrowRight, Clock } from "lucide-react";
import type { GameState } from "../shared/game";
import type { BreedingAction } from "../shared/breeding";
import {
  GENERATIONS,
  breedingBlock,
  childGeneration,
  parentKey,
} from "../shared/canine-rules";
import type { ExternalWallet } from "./external-wallet";
import { CanineArt } from "./CanineArt";
export function Breeding({
  state,
  wallet,
  refresh,
  connect,
}: {
  state: GameState;
  wallet: ExternalWallet | null;
  refresh: () => Promise<unknown>;
  connect: () => void;
}) {
  const [first, setFirst] = useState(""),
    [second, setSecond] = useState("");
  const [review, setReview] = useState<{
      action: BreedingAction;
      nonce: string;
    } | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const config = state.breedingConfig,
    chain = state.breeding;
  const used = chain?.parents ?? {};
  const pending = config && wallet ? wallet.pendingBreeding(config) : [];
  const a = state.canines.find((c) => parentKey(c) === first),
    b = state.canines.find((c) => parentKey(c) === second);
  const eligible =
    !!chain &&
    !!a &&
    !!b &&
    first !== second &&
    !breedingBlock(a, used) &&
    !breedingBlock(b, used);
  function prepare(action: BreedingAction) {
    setError("");
    setMessage("");
    setReview({ action, nonce: crypto.randomUUID().replaceAll("-", "") });
  }
  async function send(r: NonNullable<typeof review>) {
    if (!wallet || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await wallet.breed(r.action, r.nonce);
      setReview(null);
      setFirst("");
      setSecond("");
      setMessage(
        "Submitted in Sapient. The page will update after the chain confirms.",
      );
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to submit breeding");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="page-section rebirth-page breeding-page">
      <div className="eyebrow">
        <GitMerge size={16} /> THE NEXT GENERATION
      </div>
      <h1>
        Two canines.
        <br />
        <em>A new combination.</em>
      </h1>
      <p className="section-intro">
        Build your Arkimals bloodline. Eight inherited genes, a surprise colour,
        and a canine that is yours to keep.
      </p>
      <div className="breeding-rules">
        <article>
          <b>One breeding per parent</b>
          <p>
            Both parents return after the hatch. Their breeding use follows the
            NFT, including after a transfer.
          </p>
        </article>
        <article>
          <b>Eight independent choices</b>
          <p>
            Each gene has a 50/50 chance of coming from either parent. Colour is
            drawn equally from red, purple, green and blue.
          </p>
        </article>
        <article>
          <b>G → H → I → K → L → M → N → O</b>
          <p>
            The child is one generation after the later parent. Generation O can
            no longer breed.
          </p>
        </article>
      </div>
      <div className="rebirth-panel">
        <h2>Choose the parents</h2>
        {!state.connected ? (
          <button className="primary" onClick={connect}>
            Connect Sapient
          </button>
        ) : !config ? (
          <p>
            Breeding is awaiting contract activation. Your existing canines and
            staking positions remain available.
          </p>
        ) : (
          <>
            <p>
              Price: <strong>{config.fee / 1_000_000} test tTARI</strong> plus
              wallet network fees. Both canines and the fee are held during the
              draw. The fee goes to the treasury when the offspring is minted.
            </p>
            <div className="parent-selection">
              {[
                { label: "First parent", value: first, set: setFirst },
                { label: "Second parent", value: second, set: setSecond },
              ].map((slot, i) => (
                <label key={slot.label}>
                  {slot.label}
                  <select
                    value={slot.value}
                    disabled={busy || !!review || pending.length > 0}
                    onChange={(e) => slot.set(e.target.value)}
                  >
                    <option value="">Choose a canine</option>
                    {state.canines.map((c) => (
                      <option
                        key={parentKey(c)}
                        value={parentKey(c)}
                        disabled={
                          !!breedingBlock(c, used) ||
                          parentKey(c) === (i === 0 ? second : first)
                        }
                      >
                        {c.genotype ?? c.name} · {c.id.slice(0, 8)}
                        {breedingBlock(c, used)
                          ? ` · ${breedingBlock(c, used)}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            {(a || b) && (
              <div className="breeding-preview">
                {a && (
                  <article>
                    <CanineArt genes={a.genes} name={a.name} />
                    <b>{a.genotype ?? a.genes}</b>
                  </article>
                )}
                <ArrowRight />
                {b && (
                  <article>
                    <CanineArt genes={b.genes} name={b.name} />
                    <b>{b.genotype ?? b.genes}</b>
                  </article>
                )}
              </div>
            )}
            {eligible && (
              <p>
                Offspring generation <strong>{childGeneration(a!, b!)}</strong>{" "}
                · Parents {GENERATIONS[a!.generation]} +{" "}
                {GENERATIONS[b!.generation]} · Both keep their original genes.
              </p>
            )}
            {state.canines.length < 2 && (
              <p>
                You need two available canines. Unstake parents before breeding.
              </p>
            )}
            <button
              className="primary"
              disabled={!eligible || busy || !!review || pending.length > 0}
              onClick={() =>
                prepare({
                  kind: "breed",
                  first: { resource: a!.resource, id: a!.id },
                  second: { resource: b!.resource, id: b!.id },
                })
              }
            >
              Review breeding
            </button>
          </>
        )}
      </div>
      {pending.map((r) => (
        <div className="rebirth-panel" key={r.nonce}>
          <p>A breeding wallet request is awaiting completion.</p>
          <button disabled={busy} onClick={() => void send(r)}>
            Resume wallet approval
          </button>
        </div>
      ))}
      {review && (
        <div
          className="rebirth-panel review-panel"
          role="region"
          aria-label="Review breeding action"
        >
          <h2>
            {review.action.kind === "breed"
              ? "Review your breeding"
              : review.action.kind === "finish"
                ? "Hatch your offspring"
                : "Recover both parents and fee"}
          </h2>
          <p>
            {review.action.kind === "breed"
              ? `Two parents and ${config!.fee / 1_000_000} test tTARI will enter escrow. A fixed future epoch chooses the child. Both parents return, but each can breed only once if this completes.`
              : review.action.kind === "finish"
                ? "Mint the fixed offspring and return both parents to the wallet that started this breeding."
                : "The scheduled epoch was missed. Return both parents and the full breeding fee. Network fees are not refunded; this exact pair cannot repeat the missed attempt."}
          </p>
          <p>
            <Clock size={15} /> The wait is usually 20–40 minutes. Network fee
            approval is up to 1 tTARI per transaction. Use public spendable
            tTARI in Sapient.
          </p>
          <div className="economy-actions">
            <button disabled={busy} onClick={() => setReview(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => void send(review)}
            >
              {busy ? "Waiting for wallet…" : "Confirm in Sapient"}
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!!chain?.requests.length && (
        <div className="rebirth-panel">
          <h2>Your breedings</h2>
          {chain.requests.map((r) => (
            <article className="economy-position" key={r.id}>
              <div>
                <strong>
                  {r.status === 1
                    ? "Offspring minted · parents returned"
                    : r.status === 2
                      ? "Parents and fee recovered"
                      : r.captured || chain.epoch === r.targetEpoch
                        ? "Ready to hatch"
                        : "A new canine is on its way"}
                </strong>
                <p>
                  Parents {r.first.id.slice(0, 8)}… + {r.second.id.slice(0, 8)}…
                </p>
                {r.status === 0 && (
                  <p>
                    Draw epoch {r.targetEpoch} · current {chain.epoch}. About 20
                    minutes per epoch.
                  </p>
                )}
              </div>
              {r.status === 0 &&
                (r.captured || chain.epoch === r.targetEpoch ? (
                  <button
                    className="primary"
                    disabled={busy || !!review || pending.length > 0}
                    onClick={() => prepare({ kind: "finish", id: r.id })}
                  >
                    Hatch offspring
                  </button>
                ) : chain.epoch > r.targetEpoch ? (
                  <button
                    disabled={busy || !!review || pending.length > 0}
                    onClick={() => prepare({ kind: "refund", id: r.id })}
                  >
                    Recover parents & fee
                  </button>
                ) : (
                  <span className="pill">
                    {r.targetEpoch - chain.epoch} epoch(s)
                  </span>
                ))}
            </article>
          ))}
        </div>
      )}
      <p className="fine-print">
        The core inheritance and generation rules follow the main game. EGG
        payments, coupons, gene-fixing and mirroring are not active in this Tari
        release. Staging prices are test configuration, not an EGG/TARI exchange
        rate.
      </p>
    </section>
  );
}
