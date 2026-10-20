import { useEffect, useState } from "react";
import { ArrowRight, Flame, Sparkles } from "lucide-react";
import {
  HALLOWEEN_REWARDS,
  type RebirthInput,
  type RebirthReceipt,
} from "../shared/rebirth";
import type { GameState } from "../shared/game";
import { CanineArt } from "./CanineArt";
import type { ExternalWallet } from "./external-wallet";

export function RewardArt({
  reward,
  className = "",
}: {
  reward: number;
  className?: string;
}) {
  const spec = HALLOWEEN_REWARDS[reward];
  return (
    <img
      className={"reward-art " + className}
      src={import.meta.env.BASE_URL + `arkimals/${spec.image}.svg`}
      alt={spec.name}
    />
  );
}
type Api = <T>(path: string, body?: unknown) => Promise<T>;
export function Rebirth({
  state,
  external,
  api,
  refresh,
  connect,
  incubate,
}: {
  state: GameState;
  external: ExternalWallet | null;
  api: Api;
  refresh: () => Promise<unknown>;
  connect: () => void;
  incubate: () => void;
}) {
  const [selection, setSelection] = useState(""),
    [reward, setReward] = useState(0);
  const [review, setReview] = useState<RebirthInput | null>(null),
    [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const [receipts, setReceipts] = useState<RebirthReceipt[]>([]);
  const canine = state.canines.find(
    (c) => `${c.resource}/${c.id}` === selection,
  );
  const load = async () => {
    if (state.connected && !external) setReceipts(await api("/rebirths"));
  };
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [state.account]);
  const pending = receipts.find((r) =>
    ["submitting", "submitted"].includes(r.status),
  );
  const externalPending =
    external && state.rebirth
      ? external.pendingRebirths(state.rebirth)[0]
      : undefined;
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Rebirth could not finish");
    } finally {
      setBusy(false);
      await load().catch(() => {});
    }
  }
  return (
    <section className="page-section rebirth-page">
      <div className="eyebrow">
        <Flame size={16} /> THE HALLOWEEN REBIRTH
      </div>
      <h1>
        A new life.
        <br />
        <em>A familiar face.</em>
      </h1>
      <p className="section-intro">
        Give one canine a final bow. Welcome a Halloween collectible from the
        world of Arkimals.
      </p>
      <div className="ritual-steps">
        <span>01 · Choose a canine</span>
        <ArrowRight size={16} />
        <span>02 · Choose its next life</span>
        <ArrowRight size={16} />
        <span>03 · Confirm & mint</span>
      </div>
      <div className="reward-grid">
        {HALLOWEEN_REWARDS.map((r, i) => (
          <button
            type="button"
            className={"reward-option " + (reward === i ? "selected" : "")}
            key={r.original}
            aria-pressed={reward === i}
            disabled={busy || !!review}
            onClick={() => setReward(i)}
          >
            <span className="pill">{r.kind}</span>
            <RewardArt reward={i} />
            <h3>{r.name}</h3>
            <p>{r.description}</p>
            <span className="reward-choice">
              {reward === i ? "Selected for rebirth" : "Choose this reward"}{" "}
              <Sparkles size={15} />
            </span>
          </button>
        ))}
      </div>
      <p className="fine-print">
        Original Arkimals artwork · New Tari testnet NFTs · Choose your reward;
        no random draw · No main-game prize claim
      </p>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {success && (
        <div className="notice" role="status">
          {success}
        </div>
      )}
      {!state.connected ? (
        <div className="rebirth-panel">
          <h2>Your pack’s next chapter.</h2>
          <p>Connect the wallet holding your Tari canines to begin.</p>
          <button className="primary" onClick={connect}>
            Connect wallet <ArrowRight size={17} />
          </button>
        </div>
      ) : !state.rebirth ? (
        <div className="notice">
          The Halloween rebirth contract is being prepared. Your existing
          canines remain available.
        </div>
      ) : (
        <>
          {externalPending && (
            <div className="notice">
              <div>
                <strong>
                  Saved Sapient rebirth:{" "}
                  {HALLOWEEN_REWARDS[externalPending.reward].name}
                </strong>
                <p>
                  Resume its original approval request, including after a page
                  reload.
                </p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() => {
                  setReview(externalPending);
                  setReward(externalPending.reward);
                  setAck(false);
                }}
              >
                Resume rebirth
              </button>
            </div>
          )}
          {pending && (
            <div className="notice">
              <div>
                <strong>A rebirth is waiting for confirmation.</strong>
                <p>
                  Your saved request is retained. Check it before offering
                  another canine.
                </p>
              </div>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    const r = await api<RebirthReceipt>(
                      `/rebirths/${pending.key}/check`,
                      {},
                    );
                    if (r.status === "accepted")
                      setSuccess(
                        `${HALLOWEEN_REWARDS[r.reward].name} has joined your collection.`,
                      );
                    else if (r.status === "rejected")
                      throw new Error(
                        "The transaction was rejected. The canine was not exchanged.",
                      );
                  })
                }
              >
                Check rebirth
              </button>
            </div>
          )}
          {review ? (
            <div className="rebirth-panel rebirth-review">
              <div>
                <div className="eyebrow">REVIEW YOUR REBIRTH</div>
                <h2>One farewell. One welcome.</h2>
                <p>
                  Exchange canine <code>{review.id}</code> for{" "}
                  <strong>{HALLOWEEN_REWARDS[review.reward].name}</strong>.
                </p>
                <p>
                  The canine is permanently locked in the rebirth contract and
                  leaves your wallet. There is no undo or withdrawal. Your
                  chosen Halloween NFT is minted to this same wallet in the same
                  transaction.
                </p>
                <details>
                  <summary>Collection and recipient</summary>
                  <p>
                    Canine collection: <code>{review.resource}</code>
                  </p>
                  <p>
                    Your wallet: <code>{state.account}</code>
                  </p>
                  <p>
                    Rebirth contract: <code>{state.rebirth.component}</code>
                  </p>
                </details>
                <p>
                  Maximum network fee: 1 tTARI. A rejected transaction does not
                  exchange your canine; network fees may still apply.
                </p>
                <label className="rebirth-ack">
                  <input
                    type="checkbox"
                    checked={ack}
                    disabled={busy}
                    onChange={(e) => setAck(e.target.checked)}
                  />{" "}
                  I understand this permanently exchanges my canine for the
                  selected Halloween NFT.
                </label>
                <div className="rebirth-actions">
                  <button
                    className="primary"
                    disabled={busy || !ack}
                    onClick={() =>
                      void run(async () => {
                        if (external) await external.rebirth(review);
                        else {
                          const r = await api<RebirthReceipt>(
                            "/rebirths",
                            review,
                          );
                          if (r.status !== "accepted")
                            throw new Error(
                              "Rebirth was rejected or is still pending. Check its saved receipt.",
                            );
                        }
                        setSuccess(
                          `${HALLOWEEN_REWARDS[review.reward].name} has joined your collection.`,
                        );
                        setReview(null);
                        setSelection("");
                        setAck(false);
                      })
                    }
                  >
                    {busy
                      ? "Waiting for your wallet…"
                      : "Confirm rebirth & mint"}{" "}
                    <Flame size={17} />
                  </button>
                  <button
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                      setReview(null);
                      setAck(false);
                    }}
                  >
                    Back
                  </button>
                </div>
              </div>
              <RewardArt reward={review.reward} />
            </div>
          ) : state.canines.length ? (
            <div className="rebirth-panel rebirth-picker">
              <div>
                <div className="eyebrow">OFFER ONE CANINE</div>
                <h2>Choose who begins again.</h2>
                <p>
                  Both original and current Tari canines can enter. The exchange
                  is permanent; review it before you confirm.
                </p>
                <label>
                  Your canine
                  <select
                    value={selection}
                    disabled={busy || !!pending || !!externalPending}
                    onChange={(e) => setSelection(e.target.value)}
                  >
                    <option value="">Select a canine from your wallet</option>
                    {state.canines.map((c) => (
                      <option
                        key={`${c.resource}/${c.id}`}
                        value={`${c.resource}/${c.id}`}
                      >
                        {c.name} · {c.id.slice(0, 8)}
                        {c.legacy ? " · original" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="primary"
                  disabled={
                    !canine ||
                    busy ||
                    !!pending ||
                    !!externalPending ||
                    !!state.setupError
                  }
                  onClick={() => {
                    if (canine) {
                      setReview({
                        resource: canine.resource,
                        id: canine.id,
                        reward,
                      });
                      setAck(false);
                    }
                  }}
                >
                  Review rebirth <ArrowRight size={17} />
                </button>
              </div>
              <div className="rebirth-offering">
                {canine ? (
                  <CanineArt
                    genes={canine.genes}
                    variant={canine.variant}
                    name={canine.name}
                  />
                ) : (
                  <Flame size={80} />
                )}
              </div>
            </div>
          ) : (
            <div className="rebirth-panel">
              <h2>Every new life starts with a canine.</h2>
              <p>
                Incubate and mint a canine first, or receive one from another
                Tari player.
              </p>
              <button className="primary" onClick={incubate}>
                Visit the incubator <ArrowRight size={17} />
              </button>
            </div>
          )}
        </>
      )}
      {(state.halloween?.length ?? 0) > 0 && (
        <section className="rebirth-owned">
          <h2>Your Halloween familiars</h2>
          <div className="collection-grid">
            {state.halloween!.map((n) => (
              <article className="canine-card" key={n.id}>
                <RewardArt reward={n.reward} />
                <span className="pill">Reborn · Tari edition</span>
                <h3>{n.name}</h3>
                <p>{n.original}</p>
                <details>
                  <summary>NFT & lineage</summary>
                  <dl>
                    <dt>NFT ID</dt>
                    <dd>{n.id}</dd>
                    <dt>Collection</dt>
                    <dd>{n.resource}</dd>
                    <dt>Original canine</dt>
                    <dd>{n.sourceId}</dd>
                    <dt>Original collection</dt>
                    <dd>{n.sourceResource}</dd>
                  </dl>
                </details>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}
