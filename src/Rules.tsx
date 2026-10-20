import {
  GENERATIONS,
  MAIN_GAME_REBIRTH_TABLE,
  mainGameFarmPower,
} from "../shared/canine-rules";
export function Rules() {
  const rows = [
    [
      "Incubation",
      "Paid hatch; price rises with total supply. Genesis genes E–H; generation G; colour A–D.",
      "Current Tari incubation is still free and operator-sealed. Paid pricing and supply controls are pending.",
    ],
    [
      "Breeding",
      "Two parents; one completed breeding each; eight independent inherited genes; next generation; parents returned.",
      "Breeding is activated when its on-chain deployment is available. Bred canines have their own staking and Halloween rebirth pool; original positions stay in the founding pool.",
    ],
    [
      "Perches",
      "Buy a colour-matching perch. Staking occupies it; withdrawal restores it.",
      "Required for the production farm; not active in the existing pool.",
    ],
    [
      "Farm power",
      "Gene diversity × cached base power × live rarity, plus item and wearable boosts.",
      "Exact reference calculation imported. The existing on-chain pool still uses equal shares.",
    ],
    [
      "Rebirth",
      "8 WAVES; base reward table below, plus any active event bonus. Optional double, erase and rescue items.",
      "Tari currently draws from six Halloween NFTs for 8 test tTARI; it does not yet use the main-game item table.",
    ],
    [
      "Income",
      "75% of native incubation/rebirth fees becomes leasing principal; actual leasing income funds rewards.",
      "Tari currently distributes 75% of completed rebirth fees directly. No leasing yield or fixed APR.",
    ],
    [
      "Items",
      "Coupons, fixed/free genes, mirrors, rescue, double rewards, wearables and farming boosts.",
      "Not active in Tari. These require item minting, ownership checks, consumption and effects.",
    ],
  ];
  return (
    <section className="page-section rules-page">
      <div className="eyebrow">ARKIMALS · RULES & RELEASE STATUS</div>
      <h1>The full canine lifecycle.</h1>
      <p className="section-intro">
        The main game is our rule source. This page distinguishes the deployed
        Tari rules from the remaining production port.
      </p>
      <div className="rebirth-panel">
        <h2>What an epoch means</h2>
        <p>
          One Tari epoch is approximately 20 minutes, tied to base-layer blocks.
          A draw scheduled at current epoch + 2 normally waits 20–40 minutes.
          Delays can be longer; the on-chain epoch, not a countdown, determines
          readiness.
        </p>
        <a
          href="https://ootle.tari.com/guides/randomness/"
          target="_blank"
          rel="noreferrer"
        >
          Tari’s epoch and randomness guidance ↗
        </a>
      </div>
      <div className="rules-table-wrap">
        <table className="rules-table">
          <thead>
            <tr>
              <th>Step</th>
              <th>Main-game rule</th>
              <th>Tari status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([step, rule, status]) => (
              <tr key={step}>
                <th>{step}</th>
                <td>{rule}</td>
                <td>{status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rebirth-panel">
        <h2>Breeding generations</h2>
        <p>{GENERATIONS.join(" → ")}</p>
        <p>
          The child follows the later parent by one generation. G + I produces
          K. N + N produces O. O cannot breed. Changing wallet ownership does
          not reset a completed breeding use.
        </p>
      </div>
      <div className="rebirth-panel">
        <h2>How main-game FP is calculated</h2>
        <p>
          Gene power = floor(100 × 1.5<sup>distinct genes</sup>). At the first
          stake, this is multiplied by the game’s age multiplier to cache base
          power. Rarity counts canines with the same gene quantities and
          generation, regardless of gene order.
        </p>
        <p>
          Rarity = floor(√floor(10,000 ÷ group quantity)); if that rounds to
          zero, use 2. Rare power = floor(base power × rarity ÷ 100). Item
          boosts and wearable boosts add separately, with the main game’s
          integer rounding.
        </p>
        <p>
          Example at a 100% age multiplier, group quantity 1, no boosts: a
          single-gene canine has{" "}
          <b>
            {mainGameFarmPower({
              genes: "EEEEEEEE",
              groupQuantity: 1n,
              multiplier: 100n,
            }).fp.toString()}{" "}
            FP
          </b>
          ; an eight-gene canine has{" "}
          <b>
            {mainGameFarmPower({
              genes: "ABCDEFGH",
              groupQuantity: 1n,
              multiplier: 100n,
            }).fp.toString()}{" "}
            FP
          </b>
          . These examples are not the current Tari pool’s payout weights.
        </p>
        <p>
          A Tari epoch-based age multiplier and the reward currency need to be
          configured before activating a production farm.
        </p>
      </div>
      <div className="rebirth-panel">
        <h2>Main-game rebirth table</h2>
        <p>
          The main game’s base rewards are different from the six-NFT Tari
          Halloween draw. The captured live event configuration additionally
          awards a Halloween Soul with 40% probability during its configured
          event period.
        </p>
        <div className="rules-rewards">
          {MAIN_GAME_REBIRTH_TABLE.map(([name, weight]) => (
            <span key={name}>
              {name}
              <b>{weight / 10}%</b>
            </span>
          ))}
        </div>
        <p>
          Item rewards need their downstream uses implemented before this table
          can replace the Tari draw. Existing rebirths keep the odds they
          started with.
        </p>
      </div>
      <p className="fine-print">
        Main-game contracts and oracle configuration captured 20 October 2026.
        This is a testnet release, not a declaration of production readiness.
      </p>
    </section>
  );
}
