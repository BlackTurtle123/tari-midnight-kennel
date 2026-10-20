import { useEffect, useState } from "react";
import { ArrowUpRight, KeyRound, Send } from "lucide-react";
import type { GameState } from "../shared/game";
import {
  microTari,
  type TransferInput,
  type TransferReceipt,
} from "../shared/transfers";

type Api = <T>(path: string, body?: unknown) => Promise<T>;
export function WalletTools({
  state,
  external,
  api,
  refresh,
}: {
  state: GameState;
  external: boolean;
  api: Api;
  refresh: () => Promise<unknown>;
}) {
  const [destination, setDestination] = useState("");
  const [selection, setSelection] = useState("tari");
  const [amount, setAmount] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("public");
  const [review, setReview] = useState<TransferReceipt | null>(null);
  const [receipts, setReceipts] = useState<TransferReceipt[]>([]);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const pending = receipts.find(
    (r) => r.status === "submitting" || r.status === "submitted",
  );
  async function reload() {
    const records = await api<TransferReceipt[]>("/wallet/transfers");
    setReceipts(records);
    return records;
  }
  useEffect(() => {
    if (!external) void reload().catch((e) => setError(e.message));
  }, [external]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Wallet action failed");
    } finally {
      setBusy(false);
      if (!external) await reload().catch(() => {});
    }
  }
  async function prepare() {
    let asset: TransferInput["asset"];
    if (selection === "tari") {
      microTari(amount);
      asset = { kind: "tari", amount, visibility };
    } else {
      const canine = [...state.canines, ...(state.halloween ?? [])].find(
        (c) => c.resource + "/" + c.id === selection,
      );
      if (!canine)
        throw new Error("Select an NFT currently held by this wallet");
      asset = { kind: "canine", id: canine.id, resource: canine.resource };
    }
    const r = await api<TransferReceipt>("/wallet/transfers/review", {
      destination: destination.trim(),
      asset,
    });
    setReview(r);
    setAcknowledged(false);
  }
  return (
    <section
      className="wallet-tools"
      aria-label="Wallet transfers and recovery"
    >
      <details>
        <summary>
          <Send size={16} /> Transfer assets
        </summary>
        {external ? (
          <div className="wallet-tool-body">
            <p>
              Your Sapient wallet controls its transfers. Open the extension,
              select the same Esmeralda account, and use its Send controls.
              Confirm the recipient and asset inside Sapient.
            </p>
            <p>
              To move assets out of your old staging wallet, disconnect Sapient
              here and choose <strong>Existing staging wallet</strong>, then
              open Transfer assets.
            </p>
            <p>
              If Sapient reports “No vault for resource” while unshielding Tari,
              its public balance may not be initialized. From your funded
              Existing staging wallet, send a small Tari amount to your Sapient
              address using{" "}
              <strong>Public balance — for fees and unshielding</strong>. After
              it confirms, retry Unshield in Sapient.
            </p>
          </div>
        ) : (
          <div className="wallet-tool-body">
            <p>
              Move test Tari or one canine NFT to another Esmeralda wallet.
              Transfer your NFTs first and keep test Tari for fees. Finish any
              pending incubation with its original wallet before moving assets.
            </p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            {pending ? (
              <div role="status">
                <strong>A transfer is awaiting confirmation.</strong>
                <p>
                  {pending.error ||
                    "Check the saved receipt before sending anything else."}
                </p>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() =>
                    void action(async () => {
                      await api(`/wallet/transfers/${pending.id}/check`, {});
                      await refresh();
                    })
                  }
                >
                  {busy ? "Checking…" : "Check transfer"}
                </button>
              </div>
            ) : review ? (
              <div className="transfer-review" aria-label="Review transfer">
                <h3>Review before sending</h3>
                <dl>
                  <dt>From</dt>
                  <dd>{review.source}</dd>
                  <dt>To</dt>
                  <dd>{review.destination}</dd>
                  <dt>Asset</dt>
                  <dd>
                    {review.asset.kind === "tari"
                      ? review.asset.amount + " tTARI"
                      : "Canine NFT " + review.asset.id}
                  </dd>
                  {review.asset.kind === "tari" && (
                    <>
                      <dt>Recipient balance</dt>
                      <dd>
                        {review.asset.visibility === "public"
                          ? "Public — the amount and recipient are visible on-chain"
                          : "Private — recipient may need to scan incoming payments"}
                      </dd>
                    </>
                  )}
                  {review.asset.kind === "canine" && (
                    <>
                      <dt>Collection</dt>
                      <dd>{review.asset.resource}</dd>
                    </>
                  )}
                  <dt>Maximum network fee</dt>
                  <dd>{review.maxFee} tTARI</dd>
                </dl>
                <label className="transfer-ack">
                  <input
                    type="checkbox"
                    checked={acknowledged}
                    onChange={(e) => setAcknowledged(e.target.checked)}
                  />
                  I checked the full recipient address. Sending moves this asset
                  out of this wallet.
                </label>
                <button
                  className="primary"
                  disabled={busy || !acknowledged}
                  onClick={() =>
                    void action(async () => {
                      const result = await api<TransferReceipt>(
                        `/wallet/transfers/${review.id}/send`,
                        {},
                      );
                      setReview(null);
                      setReceipts((old) => [
                        result,
                        ...old.filter((r) => r.id !== result.id),
                      ]);
                      await refresh();
                    })
                  }
                >
                  {busy ? "Submitting…" : "Confirm transfer"}{" "}
                  <ArrowUpRight size={16} />
                </button>
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => setReview(null)}
                >
                  Back without sending
                </button>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void action(prepare);
                }}
              >
                <label>
                  Recipient Esmeralda payment address
                  <input
                    required
                    autoComplete="off"
                    spellCheck={false}
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    placeholder="otl_esm_…"
                  />
                </label>
                <label>
                  Asset
                  <select
                    value={selection}
                    onChange={(e) => setSelection(e.target.value)}
                  >
                    <option value="tari">Test Tari (tTARI)</option>
                    {[...state.canines, ...(state.halloween ?? [])].map((c) => (
                      <option
                        key={c.resource + c.id}
                        value={c.resource + "/" + c.id}
                      >
                        {c.name} · {c.id.slice(0, 8)}…
                        {"legacy" in c && c.legacy
                          ? " · original collection"
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selection === "tari" && (
                  <>
                    <label>
                      Amount in tTARI
                      <input
                        required
                        inputMode="decimal"
                        autoComplete="off"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.000001"
                      />
                    </label>
                    <label>
                      Recipient balance
                      <select
                        value={visibility}
                        onChange={(e) =>
                          setVisibility(e.target.value as "private" | "public")
                        }
                      >
                        <option value="private">Private balance</option>
                        <option value="public">
                          Public balance — for fees and unshielding
                        </option>
                      </select>
                    </label>
                    <p className="fine-print">
                      {visibility === "public"
                        ? "This deposits into the recipient’s public Tari vault, creating it if needed. The amount and recipient are public. A small deposit can enable Sapient fees and Unshield."
                        : "This creates a private payment. It does not fund the recipient’s public vault. Choose Public balance if Sapient reports “No vault for resource”."}
                    </p>
                  </>
                )}
                <button
                  className="primary"
                  disabled={
                    busy || state.incubations.some((r) => r.stage !== "hatched")
                  }
                >
                  {busy ? "Checking transfer…" : "Review transfer"}
                </button>
                <p className="fine-print">
                  Review runs a simulation. Nothing is sent until you confirm.
                  Maximum fee: 1 tTARI, paid by your sending wallet.
                </p>
              </form>
            )}
            {receipts.some((r) => r.status !== "prepared") && (
              <div className="transfer-history">
                <h3>Saved transfers</h3>
                {receipts
                  .filter((r) => r.status !== "prepared")
                  .slice(0, 10)
                  .map((r) => (
                    <details key={r.id}>
                      <summary>
                        {r.status === "accepted" ? "Confirmed" : r.status} ·{" "}
                        {r.asset.kind === "tari"
                          ? r.asset.amount + " tTARI"
                          : "Canine NFT"}
                      </summary>
                      <p>
                        Recipient: <code>{r.destination}</code>
                      </p>
                      <p>
                        Transfer reference: <code>{r.id}</code>
                      </p>
                      {r.transactionId && (
                        <p>
                          Transaction: <code>{r.transactionId}</code>
                        </p>
                      )}
                      {r.asset.kind === "tari" && (
                        <p>
                          Recipient balance:{" "}
                          {r.asset.visibility === "public"
                            ? "Public"
                            : "Private"}
                        </p>
                      )}
                      {r.error && <p>{r.error}</p>}
                      {r.status === "accepted" && (
                        <p>
                          Refresh the recipient wallet. For private Tari, use
                          its incoming-payment scan if needed. Your old wallet
                          and recovery records remain intact.
                        </p>
                      )}
                    </details>
                  ))}
              </div>
            )}
          </div>
        )}
      </details>
      <details>
        <summary>
          <KeyRound size={16} /> Export / back up seed
        </summary>
        <div className="wallet-tool-body">
          {external ? (
            <>
              <h3>Export inside Sapient</h3>
              <ol>
                <li>Open the Sapient extension and unlock it.</li>
                <li>
                  Open Settings, then its recovery-phrase / mnemonic option.
                </li>
                <li>
                  Follow Sapient’s password check and save the recovery words
                  privately.
                </li>
              </ol>
              <p>
                The game cannot read or export Sapient’s seed. Never paste the
                words into this page.
              </p>
            </>
          ) : (
            <>
              <h3>This hosted account has no separate recovery phrase</h3>
              <p>
                The existing staging accounts share a master seed with other
                players and the operator. Exporting it would expose all of those
                wallets, so it is not available through a player session.
              </p>
              <ol>
                <li>
                  Create your own Esmeralda wallet in Sapient and back up its
                  recovery phrase there.
                </li>
                <li>Finish any pending incubation in this existing wallet.</li>
                <li>
                  Use Transfer assets to move your canine NFTs first, then your
                  test Tari, to your Sapient payment address.
                </li>
                <li>Connect Sapient and check the received assets.</li>
              </ol>
              <p>
                Your existing seed, wallet and NFTs are not deleted by changing
                connection methods. Keep this browser’s cookies until your
                transfers are confirmed.
              </p>
            </>
          )}
          <a href="https://sapient.tari.mw/" target="_blank" rel="noreferrer">
            Sapient wallet <ArrowUpRight size={14} />
          </a>
        </div>
      </details>
    </section>
  );
}
