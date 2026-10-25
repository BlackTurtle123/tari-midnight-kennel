import { GENERATIONS } from "../shared/canine-rules";
import { HALLOWEEN_REWARDS } from "../shared/rebirth";
export function Rules({ incubationFee, connected, pending }: { incubationFee?: import("../shared/incubation-fee").IncubationFee; connected: boolean; pending?: boolean }) {
  const rows = [
    ["Incubation", pending ? "New incubations are paused until the treasury is activated. Existing incubations remain saved without a second payment."
      : incubationFee ? `${Number(incubationFee.amount) / 1_000_000} test tTARI is paid once at reservation to fund delivery and the operator treasury. Resume and hatch do not charge another incubation fee.`
      : connected ? "This deployment has no incubation treasury fee." : "Connect your wallet to view the active incubation price before approval."],
    ["Breeding", "Choose two fertile canines from your wallet. Each can breed once successfully; both parents return afterwards and become sterile. The child inherits eight genes and advances one generation beyond the later parent. The approval screen shows the breeding fee."],
    ["Staking", "Each staked canine has one equal reward share. Staked canines remain in My pack. Withdraw before breeding, transferring or using a canine for rebirth."],
    ["Rebirth", "8 test tTARI and one canine enter escrow. Completion permanently retires the canine and mints one of the six Halloween NFTs listed below."],
    ["Farm rewards", "On completed rebirth, 75% of the fee goes to the farm and 25% to treasury. If the farm is empty, the entire fee goes to treasury. Rewards depend on funded fees; there is no fixed APR or leasing income."],
  ];
  return <section className="page-section rules-page">
    <div className="eyebrow">ARKIMALS · TARI GAME RULES</div>
    <h1>Your canine lifecycle.</h1>
    <p className="section-intro">These are the active rules on Tari Esmeralda testnet. Prices use test tTARI. Wallet network fees are additional.</p>
    <div className="rules-table-wrap"><table className="rules-table"><thead><tr><th>Activity</th><th>How it works on Tari</th></tr></thead><tbody>
      {rows.map(([step, rule]) => <tr key={step}><th>{step}</th><td>{rule}</td></tr>)}
    </tbody></table></div>
    <div className="rebirth-panel"><h2>Genes and fertility</h2><p>Genes are shown directly on each canine card. Fertile canines can breed; sterile canines have already bred or reached generation O. A reserved canine is waiting for its breeding request to resolve. Staking does not make a canine sterile.</p><p>Generations: {GENERATIONS.join(" → ")}. G + I produces K; N + N produces O. Transferring a canine does not reset its breeding use.</p></div>
    <div className="rebirth-panel"><h2>Rebirth rewards</h2><p>Each completed rebirth gives one collectible NFT, with these chances.</p><div className="rules-rewards">
      {HALLOWEEN_REWARDS.map(r => <span key={r.name}>{r.name}<b>{r.odds}%</b></span>)}
    </div></div>
    <div className="rebirth-panel"><h2>Waiting for a draw</h2><p>Breeding and rebirth use a fixed draw at the current epoch + 2. An epoch is approximately 20 minutes, so the usual wait is 20–40 minutes; network delays can make it longer. The on-chain epoch determines readiness.</p><p>If the scheduled epoch is captured, you can complete the draw afterwards. If it was missed, recover the escrowed canines and game fee. Network fees are not refunded. A refunded breeding pair cannot retry together, but each parent can breed with another eligible canine.</p><p>Incubation uses a server-generated result sealed before reveal, so it does not wait for a future epoch.</p><a href="https://ootle.tari.com/guides/randomness/" target="_blank" rel="noreferrer">Tari’s epoch and randomness guidance ↗</a></div>
    <p className="fine-print">Esmeralda testnet release. Review the amount and action in your wallet before approving.</p>
  </section>;
}
