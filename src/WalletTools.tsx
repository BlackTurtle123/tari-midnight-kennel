import { useState } from "react";
import { ArrowUpRight } from "lucide-react";

export function WalletTools({
  balance,
  address,
  copy,
}: {
  balance?: string;
  address?: string;
  copy: (address: string) => Promise<unknown>;
}) {
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState(false);
  return (
    <section className="wallet-summary" aria-label="Wallet">
      <span className="wallet-balance" title="Public spendable test Tari">
        {balance ?? "—"} <small>tTARI</small>
      </span>
      <details>
        <summary>Receive</summary>
        <div className="receive-coins">
          <small>Esmeralda testnet</small>
          <code>{address ?? "Address unavailable"}</code>
          <button
            className="secondary"
            disabled={!address}
            onClick={async () => {
              if (address) {
                try {
                  await copy(address);
                  setCopied(address);
                  setCopyError(false);
                } catch {
                  setCopied("");
                  setCopyError(true);
                }
              }
            }}
          >
            {address && copied === address ? "Copied" : "Copy address"}
          </button>
          {copyError && (
            <small role="alert">Couldn’t copy. Select the address above.</small>
          )}
        </div>
      </details>
      <a href="https://sapient.tari.mw/" target="_blank" rel="noreferrer">
        Send <ArrowUpRight size={14} />
      </a>
    </section>
  );
}
