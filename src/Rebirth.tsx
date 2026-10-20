import { useEffect, useState } from "react";
import { ArrowRight, Flame, Sparkles, Coins } from "lucide-react";
import { HALLOWEEN_REWARDS, type EconomyAction } from "../shared/rebirth";
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
  const r = HALLOWEEN_REWARDS[reward];
  return r ? (
    <img
      className={"reward-art " + className}
      src={import.meta.env.BASE_URL + `arkimals/${r.image}.svg`}
      alt={r.name}
    />
  ) : null;
}
const tari = (micro: string | number) =>
  (Number(micro) / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
export function Rebirth({
  mode,
  state,
  external,
  refresh,
  connect,
  incubate,
}: {
  mode: "rebirth" | "staking";
  state: GameState;
  external: ExternalWallet | null;
  refresh: () => Promise<unknown>;
  connect: () => void;
  incubate: () => void;
}) {
  const [pool, setPool] = useState<"original" | "offspring">("original");
  const allState = state;
  const config = pool === "offspring" ? state.offspringRebirth : state.rebirth;
  state = {
    ...state,
    rebirth: config,
    economy: pool === "offspring" ? state.offspringEconomy : state.economy,
    canines: state.canines.filter(
      (c) =>
        config && [config.current, config.legacy].includes(c.resource ?? ""),
    ),
  };
  const [review, setReview] = useState<{
      action: EconomyAction;
      nonce: string;
    } | null>(null),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (review)
      document
        .getElementById("economy-review")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [review]);
  const externalPending =
    external && state.rebirth ? external.pendingEconomy(state.rebirth) : [];
  const beginReview = (action: EconomyAction) => {
    setAck(false);
    setReview({ action, nonce: crypto.randomUUID().replaceAll("-", "") });
  };
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Wallet action could not finish",
      );
    } finally {
      setBusy(false);
    }
  }
  async function send(request: { action: EconomyAction; nonce: string }) {
    if (!external) throw new Error("Connect Sapient to continue");
    await external.act(request.action, request.nonce, state.rebirth?.component);
    setMessage("Submitted in Sapient. Refresh to see the confirmed result.");
    setReview(null);
  }
  const fee = state.rebirth?.fee ?? 8_000_000;
  const economy = state.economy;
  return (
    <section className="page-section rebirth-page">
      {allState.offspringRebirth && (
        <div className="rebirth-panel">
          <label>
            Collection pool{" "}
            <select
              value={pool}
              disabled={busy || !!review}
              onChange={(e) => {
                setPool(e.target.value as "original" | "offspring");
                setError("");
                setMessage("");
              }}
            >
              <option value="original">Founding canines</option>
              <option value="offspring">Bred canines</option>
            </select>
          </label>
          <p>
            Each collection has its own staking pool. A rebirth funds the pool
            for that collection. Switch pools to view existing positions and
            saved wallet actions.
          </p>
        </div>
      )}

      {mode === "rebirth" ? (
        <>
          <div className="eyebrow">
            <Flame size={16} /> HALLOWEEN REBIRTH
          </div>
          <h1>
            A final bow.
            <br />
            <em>A secret new life.</em>
          </h1>
          <p className="section-intro">
            Follow the Arkimals ritual: offer one canine, wait for the draw,
            then reveal a randomly minted Halloween NFT. Every completed rebirth
            funds the staking pool.
          </p>
          <div className="ritual-steps">
            <span>01 · Offer a canine + {tari(fee)} tTARI</span>
            <ArrowRight size={16} />
            <span>02 · Wait two network epochs</span>
            <ArrowRight size={16} />
            <span>03 · Reveal & mint</span>
          </div>
          <div className="reward-grid">
            {HALLOWEEN_REWARDS.map((r, i) => (
              <div className="reward-option" key={r.original}>
                <span className="pill">{r.kind}</span>
                <RewardArt reward={i} />
                <h3>{r.name}</h3>
                <p>{r.description}</p>
                <span className="reward-choice">
                  {r.odds}% draw weight <Sparkles size={15} />
                </span>
              </div>
            ))}
          </div>
          <p className="fine-print">
            Original Arkimals artwork · New Esmeralda testnet NFTs · One random
            reward per completed rebirth · No main-game redemption or item
            powers
          </p>
        </>
      ) : (
        <>
          <div className="eyebrow">
            <Coins size={16} /> CANINE FARMING
          </div>
          <h1>
            Your pack.
            <br />
            <em>A share in every ritual.</em>
          </h1>
          <p className="section-intro">
            Stake your canines, collect funded rewards, and withdraw your NFTs
            whenever you choose.
          </p>
        </>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="notice" role="status">
          {message}
        </div>
      )}
      {!state.connected ? (
        <div className="rebirth-panel">
          <h2>Your pack’s next chapter.</h2>
          <button className="primary" onClick={connect}>
            Connect wallet <ArrowRight size={17} />
          </button>
        </div>
      ) : !state.rebirth ? (
        <div className="notice">
          The rebirth and staking contracts are being prepared. You can still
          incubate and manage your existing canines.
        </div>
      ) : (
        <>
          {externalPending.map((r) => (
            <div className="notice" key={r.nonce}>
              Saved Sapient {r.action.kind} request.{" "}
              <button disabled={busy} onClick={() => void run(() => send(r))}>
                Resume wallet approval
              </button>
            </div>
          ))}
          <div className="rebirth-panel">
            <h2>
              {mode === "staking"
                ? "Choose a canine to stake"
                : "Choose a canine for rebirth"}
            </h2>
            <p>
              {mode === "rebirth"
                ? "Rebirth permanently retires the canine when its reward is minted."
                : "Staking holds your canine in the pool until you withdraw it. Each canine in the current pool has one equal reward share."}
            </p>
            {!state.canines.length ? (
              <p>
                No available canines.{" "}
                <button onClick={incubate}>Visit the incubator</button>
              </p>
            ) : (
              <div className="economy-canines">
                {state.canines.map((c) => (
                  <article className="economy-canine" key={c.resource + c.id}>
                    <CanineArt genes={c.genes} name={c.name} />
                    <h3>{c.name}</h3>
                    <small>{c.genotype ?? c.genes}</small>
                    <div className="economy-actions">
                      {mode === "staking" ? (
                        <button
                          disabled={
                            busy || !!review || externalPending.length > 0
                          }
                          onClick={() =>
                            beginReview({
                              kind: "stake",
                              resource: c.resource,
                              id: c.id,
                            })
                          }
                        >
                          Stake canine
                        </button>
                      ) : (
                        <button
                          className="primary"
                          disabled={
                            !!economy?.requests.some(
                              (r) =>
                                r.token === c.id && r.resource === c.resource,
                            ) ||
                            busy ||
                            !!review ||
                            externalPending.length > 0
                          }
                          onClick={() =>
                            beginReview({
                              kind: "begin",
                              resource: c.resource,
                              id: c.id,
                            })
                          }
                        >
                          {economy?.requests.some(
                            (r) =>
                              r.token === c.id && r.resource === c.resource,
                          )
                            ? "Rebirth already used"
                            : `Rebirth · ${tari(fee)} tTARI`}
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
          {mode === "rebirth" && !!economy?.requests.length && (
            <div className="rebirth-panel">
              <h2>Your rebirths</h2>
              {economy.requests.map((r) => (
                <article className="economy-position" key={r.id}>
                  <div>
                    <strong>
                      {r.status === 1
                        ? HALLOWEEN_REWARDS[r.reward]?.name
                        : r.status === 2
                          ? "Canine and ritual fee returned"
                          : r.captured || economy.epoch === r.targetEpoch
                            ? "Your new life is ready to reveal"
                            : "The ritual is waiting"}
                    </strong>
                    <p>
                      {r.status === 0
                        ? `Draw epoch ${r.targetEpoch} · current epoch ${economy.epoch}`
                        : `Original canine ${r.token.slice(0, 10)}…`}
                    </p>
                    {r.status === 0 && (
                      <p>
                        The ritual fee is held until Reveal &amp; mint
                        completes. Staking rewards are not funded yet.
                      </p>
                    )}
                  </div>
                  {r.status === 0 &&
                    (r.captured || economy.epoch === r.targetEpoch ? (
                      <button
                        className="primary"
                        disabled={busy}
                        onClick={() =>
                          beginReview({ kind: "finish", id: r.id })
                        }
                      >
                        Reveal & mint
                      </button>
                    ) : economy.epoch > r.targetEpoch ? (
                      <button
                        disabled={busy}
                        onClick={() =>
                          beginReview({ kind: "refund", id: r.id })
                        }
                      >
                        Recover canine & fee
                      </button>
                    ) : (
                      <span className="pill">
                        {r.targetEpoch - economy.epoch} epoch(s) to go
                      </span>
                    ))}
                </article>
              ))}
            </div>
          )}
          {mode === "staking" && (
            <div className="rebirth-panel staking-panel" id="staking">
              <div className="eyebrow">
                <Coins size={16} /> THE CANINE STAKING POOL
              </div>
              <h2>Let your pack share in the rituals.</h2>
              <p>
                75% of completed rebirth fees goes to the canines staked at that
                moment; 25% goes to the treasury. If the pool is empty, that fee
                also goes to the treasury. Starting a ritual does not pay
                rewards: they become claimable after Reveal &amp; mint
                completes. Use Claim rewards to collect them into your wallet.
              </p>
              <div className="staking-totals">
                <span>
                  <b>{economy?.totalStaked ?? 0}</b> canines staked
                </span>
                <span>
                  <b>{tari(economy?.distributed ?? 0)}</b> tTARI funded rewards
                </span>
                <span>
                  <b>{tari(economy?.claimed ?? 0)}</b> tTARI claimed
                </span>
              </div>
              {!economy?.stakes.length ? (
                <p>
                  Stake an available canine above to join the pool. There is no
                  fixed APR or guaranteed income.
                </p>
              ) : (
                economy.stakes.map((p) => (
                  <article className="economy-position" key={p.id}>
                    <div>
                      <strong>Staked canine · {p.token.slice(0, 10)}…</strong>
                      <p>{tari(p.claimable)} tTARI available to claim</p>
                    </div>
                    <div className="economy-actions">
                      <button
                        disabled={busy || p.claimable === "0"}
                        onClick={() => beginReview({ kind: "claim", id: p.id })}
                      >
                        Claim rewards
                      </button>
                      <button
                        disabled={busy}
                        onClick={() =>
                          beginReview({ kind: "unstake", id: p.id })
                        }
                      >
                        Unstake & claim
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
          <button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setMessage("Balances and rituals refreshed.");
              })
            }
          >
            Refresh pack & rewards
          </button>
        </>
      )}
      {review && (
        <div
          id="economy-review"
          className="rebirth-panel review-panel"
          role="region"
          aria-label="Review wallet action"
        >
          <h2>
            {
              {
                begin: "Review rebirth",
                stake: "Review staking",
                finish: "Reveal your Halloween NFT",
                refund: "Recover the missed ritual",
                claim: "Claim staking income",
                unstake: "Return your staked canine",
              }[review.action.kind]
            }
          </h2>
          <p>
            {review.action.kind === "begin"
              ? `One canine and ${tari(fee)} tTARI will be held for the fixed future draw. Completion permanently retires the canine and mints one random reward. The wait is two network epochs (usually around 20–40 minutes).`
              : review.action.kind === "stake"
                ? "Your canine moves into the staking contract and earns an equal share of future rebirth fees. Unstaking returns it and claims any whole-unit rewards."
                : review.action.kind === "refund"
                  ? "The scheduled epoch was not captured. The contract returns your canine and full ritual fee; network fees are not refunded."
                  : review.action.kind === "finish"
                    ? "The fixed draw mints your Halloween reward and permanently retires the original canine. The ritual fee is split between staking and the treasury."
                    : review.action.kind === "unstake"
                      ? "Your canine and claimable rewards return to the same wallet. It stops earning new fees."
                      : "Only earned, funded rewards are transferred to the same wallet."}
          </p>
          <p>
            The ritual fee requires public, spendable tTARI. Unshield in Sapient
            if your funds are private. Network fee approval: up to 1 tTARI per
            transaction, separate from the ritual fee.
          </p>
          <label className="confirm-check">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />{" "}
            {review.action.kind === "begin"
              ? "I understand my canine is permanently retired if this rebirth completes, and the reward is random."
              : "I have reviewed this wallet action."}
          </label>
          <div className="economy-actions">
            <button disabled={busy} onClick={() => setReview(null)}>
              Cancel
            </button>
            <button
              className="primary"
              disabled={busy || !ack}
              onClick={() => void run(() => send(review))}
            >
              {busy ? "Waiting for wallet…" : "Confirm in wallet"}
            </button>
          </div>
        </div>
      )}
      {mode === "rebirth" && !!state.halloween?.length && (
        <div className="rebirth-panel">
          <h2>Your Halloween collection</h2>
          <div className="reward-grid">
            {state.halloween.map((n) => (
              <article className="reward-option" key={n.resource + n.id}>
                <RewardArt reward={n.reward} />
                <h3>{n.name}</h3>
                <p>Reborn from canine {n.sourceId.slice(0, 10)}…</p>
                <small>{n.original}</small>
              </article>
            ))}
          </div>
        </div>
      )}
      {mode === "rebirth" && (
        <p className="fine-print">
          The draw uses a fixed future network epoch, not a player-selected
          reward. If its epoch is missed, recover the canine and ritual fee.
          Incubation still has the private encrypted preview; rebirth results
          become publicly reproducible when their epoch arrives.
        </p>
      )}
    </section>
  );
}
