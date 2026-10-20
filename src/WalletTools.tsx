import { ArrowUpRight, Send } from "lucide-react";

export function WalletTools() {
  return (
    <section className="wallet-tools" aria-label="Wallet transfers">
      <details>
        <summary>
          <Send size={16} /> Transfer assets
        </summary>
        <div className="wallet-tool-body">
          <p>
            Open Sapient, select your connected Esmeralda account, and use its
            Send controls. Confirm the recipient and asset inside your wallet.
          </p>
          <p>
            Rebirth uses public spendable test Tari. If your funds are private,
            use Sapient’s Unshield controls and retain enough public Tari for
            network fees.
          </p>
          <a href="https://sapient.tari.mw/" target="_blank" rel="noreferrer">
            Open Sapient’s website <ArrowUpRight size={14} />
          </a>
        </div>
      </details>
    </section>
  );
}
