export function WalletTools({ balance }: { balance?: string }) {
  return (
    <section className="wallet-summary" aria-label="Wallet balance">
      <span className="wallet-balance" title="Public spendable test Tari">
        {balance ?? "—"} <small>tTARI</small>
      </span>
    </section>
  );
}
