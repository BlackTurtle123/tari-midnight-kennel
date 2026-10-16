import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  Check,
  ChevronRight,
  Ghost,
  LockKeyhole,
  Moon,
  PawPrint,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  RefreshCw,
} from "lucide-react";
import { CanineArt, DoorArt } from "./CanineArt";
import {
  CONTEST_URL,
  RULES_URL,
  DOORS,
  VARIANTS,
  GENE_POSITIONS,
  COLOR_NAMES,
  colorForSalt,
  genotypeFor,
  type GameState,
  type Opening,
} from "../shared/game";
import "./style.css";
const empty: GameState = {
  connected: false,
  network: "Esmeralda",
  incubations: [],
  canines: [],
};
async function api<T>(path: string, body?: unknown): Promise<T> {
  const r = await fetch(import.meta.env.BASE_URL + "api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { "Content-Type": "application/json", "x-kennel-request": "1" },
    credentials: "same-origin",
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Unable to reach the kennel");
  return data;
}
const short = (s?: string) => (s ? `${s.slice(0, 16)}…${s.slice(-8)}` : "");
function App() {
  const [hosted, setHosted] = useState(false);
  useEffect(() => {
    void api<{ hosted: boolean }>("/config")
      .then((c) => setHosted(c.hosted))
      .catch(() => {});
  }, []);
  const [tab, setTab] = useState("incubator"),
    [state, setState] = useState<GameState>(empty),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [opening, setOpening] = useState<Opening | null>(null),
    [connectDialog, setConnectDialog] = useState(false);
  const refresh = async () => {
    const s = await api<GameState>("/state");
    setState(s);
    return s;
  };
  useEffect(() => {
    void refresh().catch(() => {});
  }, []);
  useEffect(() => {
    if (!state.connected) return;
    const t = setInterval(
      () => void refresh().catch((e) => setError(e.message)),
      4000,
    );
    return () => clearInterval(t);
  }, [state.connected]);
  useEffect(() => {
    if (!opening && !connectDialog) return;
    const before = document.activeElement as HTMLElement | null;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpening(null);
        setConnectDialog(false);
      }
      if (e.key === "Tab") {
        const buttons = Array.from(
          document.querySelectorAll<HTMLButtonElement>(
            ".modal button:not(:disabled)",
          ),
        );
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    window.addEventListener("keydown", handle);
    return () => {
      window.removeEventListener("keydown", handle);
      before?.focus();
    };
  }, [!!opening, connectDialog]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }
  const pending = state.incubations.find((r) => r.stage !== "hatched");
  const disabled = busy || !!pending || !!state.setupError;
  return (
    <>
      <header className="header">
        <a className="brand" href="#" onClick={() => setTab("incubator")}>
          <span className="brand-icon">
            <PawPrint size={22} />
          </span>
          <span>
            midnight<span className="brand-light"> kennel</span>
            <small>A LITTLE MISCHIEF ON TARI</small>
          </span>
        </a>
        <nav aria-label="Main navigation">
          {[
            ["incubator", "The incubator"],
            ["collection", "My canines"],
            ["secrets", "Spooky Secrets"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "nav active" : "nav"}
              onClick={() => setTab(key)}
            >
              {label}
              {key === "collection" && (
                <span className="count">{state.canines.length}</span>
              )}
            </button>
          ))}
        </nav>
        <button
          className="wallet-button"
          disabled={busy}
          onClick={() =>
            state.connected
              ? void action(async () => {
                  await api("/disconnect", {});
                  setState(empty);
                  setOpening(null);
                })
              : setConnectDialog(true)
          }
        >
          <Wallet size={16} />
          {state.connected ? "Disconnect wallet" : "Connect wallet"}
        </button>
      </header>
      <main>
        <div className="topline">
          <span>
            <span className="status-dot" /> TARI OOTLE · ESMERALDA TESTNET
          </span>
          <span>
            OCTOBER ’26 <span className="topline-divider">/</span> SPOOKY
            SECRETS
          </span>
        </div>
        {error && (
          <div className="notice error" role="alert">
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X size={18} />
            </button>
          </div>
        )}
        {state.connected && state.setupError && (
          <div className="notice">
            <LockKeyhole size={20} />
            <div>
              <strong>The kennel is waiting for its testnet setup.</strong>
              <p>{state.setupError}</p>
            </div>
          </div>
        )}
        {state.connected && (
          <section className="wallet-summary">
            <div>
              <strong>
                {hosted ? "Your staging test wallet" : "Your test wallet"}
              </strong>
              <span>{state.balance || "0.000"} tTARI · Esmeralda</span>
            </div>
            <details>
              <summary>Receive test coins</summary>
              <p>Send only Esmeralda test coins to this payment address.</p>
              <code>{state.paymentAddress}</code>
              <button
                className="secondary"
                onClick={() =>
                  void action(async () => {
                    await navigator.clipboard.writeText(
                      state.paymentAddress || "",
                    );
                  })
                }
              >
                Copy address
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  void action(async () => {
                    await api("/fund", {});
                    await refresh();
                  })
                }
              >
                Try public faucet
              </button>
              <p>
                The public faucet needs at least 1,000 tTARI for a claim. If it
                is empty, use a funded test wallet or Tari’s{" "}
                <a
                  href="https://ootle.tari.com/guides/burn-minotari/"
                  target="_blank"
                  rel="noreferrer"
                >
                  testnet burn-and-claim guide
                </a>
                .
              </p>
            </details>
          </section>
        )}
        {tab === "incubator" && (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow">
                  <Ghost size={16} /> GOOD DOGS. SPOOKY SECRETS.
                </div>
                <h1>
                  A little spooky.
                  <br />
                  <em>Entirely yours.</em>
                </h1>
                <p>
                  Knock on a door. Incubate a mystery.
                  <br />
                  Meet the canine hiding on the other side.
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    document
                      .getElementById("doors")
                      ?.scrollIntoView({ behavior: "smooth" })
                  }
                >
                  Find your familiar <ArrowRight size={18} />
                </button>
                <div className="hero-foot">
                  <LockKeyhole size={15} /> Your surprise stays secret until you
                  reveal it.
                </div>
              </div>
              <div className="hero-art">
                <div className="orbit orbit-one" />
                <div className="orbit orbit-two" />
                <span className="star star-one">✦</span>
                <span className="star star-two">✦</span>
                <Moon className="art-moon" size={46} />
                <CanineArt className="hero-dog" />
                <div className="art-note">
                  <span className="note-dot" />
                  <div>
                    Something good is hatching.
                    <small>Or something a little mischievous.</small>
                  </div>
                </div>
                <span className="edition">
                  THE MIDNIGHT COLLECTION
                  <br />
                  01 — 04
                </span>
              </div>
            </section>
            <section className="steps" aria-label="How it works">
              {[
                [
                  <Ghost />,
                  "01",
                  "Pick a porch",
                  "Three doors. One little mystery.",
                ],
                [
                  <LockKeyhole />,
                  "02",
                  "Keep a secret",
                  "Your wallet opens your surprise.",
                ],
                [
                  <PawPrint />,
                  "03",
                  "Hatch your canine",
                  "Reveal it. Mint it. Make it yours.",
                ],
              ].map(([icon, n, title, desc], i) => (
                <div className="step" key={i}>
                  <span className="step-icon">{icon}</span>
                  <div>
                    <span className="step-number">{n}</span>
                    <strong>{title}</strong>
                    <p>{desc}</p>
                  </div>
                  {i < 2 && <ChevronRight className="step-arrow" size={18} />}
                </div>
              ))}
            </section>
            <section id="doors" className="doors-section">
              <div className="section-heading">
                <div>
                  <div className="eyebrow muted">
                    YOUR NEXT LITTLE ADVENTURE
                  </div>
                  <h2>Trick, treat… or best friend?</h2>
                </div>
                <span className="pill">
                  <Sparkles size={14} /> 4 genesis canines
                </span>
              </div>
              <p className="section-intro">
                Choose a doorstep. Every door can lead to any canine. Even the
                tricks have a wagging tail.
              </p>
              {pending && (
                <div className="incubation">
                  <div className="incubation-icon">
                    <LockKeyhole />
                  </div>
                  <div className="incubation-copy">
                    <span className="eyebrow">YOUR INCUBATION</span>
                    <h3>
                      {pending.stage === "ready"
                        ? "A secret has arrived."
                        : pending.stage === "reserved"
                          ? "Preparing your wallet…"
                          : pending.stage === "hatching"
                            ? "Your canine is hatching…"
                            : "A little mystery is on its way."}
                    </h3>
                    <p>
                      {DOORS[pending.door].name} ·{" "}
                      {pending.stage.replaceAll("_", " ")} · {short(pending.id)}
                    </p>
                    {pending.error && (
                      <p className="inline-error">{pending.error}</p>
                    )}
                  </div>
                  {pending.stage === "ready" ? (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () =>
                          setOpening(
                            await api<Opening>(
                              `/incubations/${pending.id}/open`,
                              {},
                            ),
                          ),
                        )
                      }
                    >
                      <LockKeyhole size={16} /> Open privately
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void action(async () => {
                          await api(`/incubations/${pending.id}/resume`, {});
                          await refresh();
                        })
                      }
                    >
                      <RefreshCw size={16} /> Check progress
                    </button>
                  )}
                </div>
              )}
              <div className="door-grid">
                {DOORS.map((door, i) => (
                  <article className={"door-card door-" + i} key={door.name}>
                    <span className="door-number">0{i + 1}</span>
                    <DoorArt index={i} />
                    <h3>{door.name}</h3>
                    <p>{door.subtitle}</p>
                    <button
                      disabled={state.connected ? disabled : busy}
                      onClick={() =>
                        state.connected
                          ? void action(async () => {
                              const id = crypto
                                .randomUUID()
                                .replaceAll("-", "");
                              await api("/incubations", { door: i, id });
                              await refresh();
                            })
                          : setConnectDialog(true)
                      }
                    >
                      Knock on this door <ArrowUpRight size={17} />
                    </button>
                  </article>
                ))}
              </div>
              <p className="fine-print">
                Testnet only · No purchase or cash prizes · Network fees apply ·
                One incubation at a time
              </p>
            </section>
            <section className="privacy-banner">
              <span className="privacy-icon">
                <ShieldCheck size={30} />
              </span>
              <div>
                <div className="eyebrow">A SECRET WORTH KEEPING</div>
                <h3>The surprise is private. The canine becomes public.</h3>
                <p>
                  Tari delivers the reveal in an encrypted wallet memo. You
                  choose when to open it and mint.
                </p>
              </div>
              <button onClick={() => setTab("secrets")}>
                How the secret works <ArrowUpRight size={17} />
              </button>
            </section>
          </>
        )}
        {tab === "collection" && (
          <section className="page-section">
            <div className="eyebrow">YOUR PACK, YOUR STORIES</div>
            <h1>
              My <em>canines.</em>
            </h1>
            <p className="section-intro">
              Real NFTs held by your connected testnet account.
            </p>
            {state.canines.length ? (
              <div className="collection-grid">
                {state.canines.map((c) => (
                  <article className="canine-card" key={c.id}>
                    <CanineArt
                      variant={c.variant}
                      genes={c.genes}
                      name={c.name}
                    />
                    <span className="pill">
                      {c.legacy
                        ? "Original collection"
                        : VARIANTS[c.variant].kind}{" "}
                      · generation {c.generation}
                    </span>
                    <h3>{c.name}</h3>
                    <p>
                      {c.legacy
                        ? "Preserved from the first testnet collection, rendered from its original NFT genes."
                        : VARIANTS[c.variant].description}
                    </p>
                    <details>
                      <summary>NFT details</summary>
                      <dl>
                        <dt>Incubation ID</dt>
                        <dd>{c.id}</dd>
                        <dt>Genes</dt>
                        <dd>{c.genes}</dd>
                        <dt>Genotype</dt>
                        <dd>
                          {c.genotype ?? "Not recorded in the original NFT"}
                        </dd>
                        <dt>Colour</dt>
                        <dd>
                          {c.color ? COLOR_NAMES[c.color] : "Not recorded"}
                        </dd>
                        {GENE_POSITIONS.map((label, i) => (
                          <React.Fragment key={label}>
                            <dt>{label}</dt>
                            <dd>{c.genes[i]}</dd>
                          </React.Fragment>
                        ))}
                        <dt>Resource</dt>
                        <dd>{c.resource}</dd>
                      </dl>
                    </details>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <PawPrint size={42} />
                <h2>Your pack starts with a knock.</h2>
                <p>
                  {state.connected
                    ? "No canine NFTs found in this account yet."
                    : "Connect your test wallet to see your canines."}
                </p>
                <button className="primary" onClick={() => setTab("incubator")}>
                  Visit the incubator <ArrowRight size={17} />
                </button>
              </div>
            )}
          </section>
        )}
        {tab === "secrets" && (
          <section className="page-section secrets">
            <div className="eyebrow">
              <Ghost size={16} /> OCTOBER BUILD CONTEST
            </div>
            <h1>
              Spooky <em>Secrets.</em>
            </h1>
            <p className="section-intro">
              A Halloween doorstep, a mystery canine, and a real use for Tari’s
              privacy.
            </p>
            <div className="secret-grid">
              <article>
                <LockKeyhole size={26} />
                <h2>Before the reveal</h2>
                <p>
                  The operator commits a salted hash of your canine. The result
                  and secret salt travel in a Tari stealth transfer’s encrypted
                  memo. Your wallet decrypts the memo before you hatch.
                </p>
                <p>
                  The public commitment hides which of the four genesis canines
                  you received. A hidden picture alone would not do that.
                </p>
              </article>
              <article>
                <PawPrint size={26} />
                <h2>When you hatch</h2>
                <p>
                  You explicitly publish the result and salt. The contract
                  checks its commitment and your signer, then mints exactly one
                  canine NFT into the recipient fixed when incubation began.
                </p>
                <p>
                  The canine’s traits, ownership and hatch transaction are
                  public after minting.
                </p>
              </article>
            </div>
            <div className="honest-note">
              <ShieldCheck size={22} />
              <div>
                <h3>What this secret does—and doesn’t—protect</h3>
                <p>
                  The operator creates the result and knows it. The PoC operator
                  hosts both wallets. Staging separates browser sessions, but
                  the server can access their keys. Incubation account, door,
                  commitment, timing, fees and transaction links can be public.
                  Outcomes are operator-selected randomness, not provably fair
                  draws. This is a private surprise, not anonymous play.
                </p>
              </div>
            </div>
            <div className="rules">
              <div>
                <div className="eyebrow">BUILT FOR THE EVENT</div>
                <h2>The contest checklist</h2>
                <p>
                  Deadline: <strong>1 November 2026, 00:00 UTC</strong>
                  <br />
                  Eligibility and judging remain with the Tari Council.
                </p>
                <a href={CONTEST_URL} target="_blank" rel="noreferrer">
                  October theme & submission thread <ArrowUpRight size={15} />
                </a>
                <a href={RULES_URL} target="_blank" rel="noreferrer">
                  Official contest rules <ArrowUpRight size={15} />
                </a>
              </div>
              <ul>
                <li>
                  <Check /> Halloween theme + meaningful Tari privacy
                </li>
                <li>
                  <Check /> New project code after the theme announcement
                </li>
                <li>
                  <Check /> MIT open-source license; no other entries’ code
                </li>
                <li>
                  <span className="todo-dot" /> Public source link and project
                  description in one forum post
                </li>
                <li>
                  <span className="todo-dot" /> Entrant’s Tari prize-payment
                  address
                </li>
                <li>
                  <span className="todo-dot" /> Public Bluesky or Reddit
                  announcement
                </li>
                <li>
                  <span className="todo-dot" /> Confirm entrant eligibility;
                  update the same submission post
                </li>
              </ul>
            </div>
            <p className="fine-print">
              Submission is not automatic. Council members and Tari Labs
              employees cannot enter. Live deployment and the submission steps
              must be completed before presenting this as a finished entry.
            </p>
          </section>
        )}
      </main>
      <footer>
        <a
          className="footer-brand"
          href="#"
          onClick={() => setTab("incubator")}
        >
          <PawPrint size={17} /> midnight kennel
        </a>
        <span>Small paws. Big secrets.</span>
        <a href="https://ootle.tari.com/" target="_blank" rel="noreferrer">
          Built on Tari Ootle <ArrowUpRight size={14} />
        </a>
      </footer>
      {connectDialog && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
          >
            <button
              autoFocus
              className="close"
              aria-label="Close wallet dialog"
              onClick={() => setConnectDialog(false)}
            >
              <X />
            </button>
            <Wallet size={32} />
            <h2 id="connect-title">
              {hosted
                ? "Create your staging test wallet"
                : "Connect your local test wallet"}
            </h2>
            <p>
              {hosted
                ? "Staging creates a separate test account for this browser. The server holds its keys and submits transactions when you press the game buttons. Keep this browser’s cookies to retain access; use test coins only."
                : "This PoC uses the dedicated Esmeralda wallet on this computer. Connecting lets the app submit incubation and mint transactions when you press their buttons."}
            </p>
            <p>No seed phrase is requested. Use test coins only.</p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  setState(await api<GameState>("/connect", {}));
                  setConnectDialog(false);
                })
              }
            >
              {busy
                ? "Connecting…"
                : hosted
                  ? "Create or reconnect test wallet"
                  : "Connect local wallet"}{" "}
              <ArrowRight size={17} />
            </button>
            <p className="fine-print">
              Wallet daemon and funded test accounts must be set up first.
            </p>
          </section>
        </div>
      )}
      {opening && (
        <div className="modal-backdrop">
          <section
            className="modal reveal-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="reveal-title"
          >
            <button
              autoFocus
              className="close"
              aria-label="Close secret"
              onClick={() => setOpening(null)}
            >
              <X />
            </button>
            <span className="pill">
              <LockKeyhole size={14} /> PRIVATE PREVIEW
            </span>
            <CanineArt variant={opening.variant} />
            <div className="eyebrow">
              IT’S A {VARIANTS[opening.variant].kind.toUpperCase()}!
            </div>
            <h2 id="reveal-title">{VARIANTS[opening.variant].name}</h2>
            <p>{VARIANTS[opening.variant].description}</p>
            <p className="gene-strip">
              {genotypeFor(
                VARIANTS[opening.variant].genes,
                colorForSalt(opening.salt),
              )}
            </p>
            <p>
              Genesis · {COLOR_NAMES[colorForSalt(opening.salt)]} · eight gene
              positions
            </p>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="reveal-warning">
              Hatching publishes this canine’s traits and the secret opening on
              Tari. Your NFT will be public.
            </div>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  await api(`/incubations/${opening.id}/hatch`, {});
                  setOpening(null);
                  await refresh();
                  setTab("collection");
                })
              }
            >
              {busy ? "Minting on Tari…" : "Reveal & mint NFT"}{" "}
              <PawPrint size={17} />
            </button>
          </section>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
