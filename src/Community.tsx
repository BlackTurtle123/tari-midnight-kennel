import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Check, Copy, PawPrint, RefreshCw, Search, Trophy } from "lucide-react";
import { CanineArt } from "./CanineArt";
import { RewardArt } from "./Rebirth";
import { COLOR_NAMES, GENE_POSITIONS } from "../shared/game";
import { farmHref, farmName, type FarmNFT, type FarmView, type Ranking } from "../shared/community";

function Art({ item }: { item: FarmNFT }) {
  return item.kind === "canine"
    ? <CanineArt genes={item.nft.genes} name={item.nft.name} variant={item.nft.variant} />
    : <RewardArt reward={item.nft.reward} />;
}
const statusName = { wallet: "In wallet", staked: "Staked", breeding: "Breeding", rebirth: "In rebirth" };
function Freshness({ updatedAt, stale }: { updatedAt: string; stale: boolean }) {
  return <p className={stale ? "notice" : "community-updated"} role={stale ? "status" : undefined}>
    {stale ? "Network refresh unavailable. Showing the last successful update: " : "Updated "}
    <time dateTime={updatedAt}>{new Date(updatedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time>
  </p>;
}
function NFTCard({ item }: { item: FarmNFT }) {
  const n = item.nft;
  return <article className="canine-card farm-nft">
    <div className="farm-art"><Art item={item} /><span className={"pill farm-status status-" + item.status}>{statusName[item.status]}</span></div>
    <div className="farm-nft-info">
      <span className="eyebrow">{item.kind === "canine" ? `CANINE · GENERATION ${item.nft.generation}` : "HALLOWEEN NFT"}</span>
      <h3>{n.name}</h3>
      {item.kind === "canine" && <p className="farm-genes">{item.nft.genotype ?? item.nft.genes}</p>}
      <details>
        <summary>NFT details</summary>
        <dl>
          <dt>Token ID</dt><dd>{n.id}</dd>
          <dt>Collection</dt><dd>{n.resource}</dd>
          {item.kind === "canine" ? <>
            <dt>Colour</dt><dd>{item.nft.color ? COLOR_NAMES[item.nft.color] : "Not recorded"}</dd>
            {GENE_POSITIONS.map((position, i) => <div className="farm-gene-row" key={position}><dt>{position}</dt><dd>{item.nft.genes[i]}</dd></div>)}
          </> : <><dt>Original artwork</dt><dd>{item.nft.original}</dd></>}
        </dl>
      </details>
    </div>
  </article>;
}

export function Community({ account, currentAccount }: { account?: string; currentAccount?: string }) {
  const [data, setData] = useState<Ranking | FarmView>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(undefined);
    const path = account ? `farms/${encodeURIComponent(account)}` : "ranking";
    void fetch(`${import.meta.env.BASE_URL}api/community/${path}`, { signal: controller.signal, credentials: "omit" })
      .then(async r => {
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Unable to load the farms");
        return body as Ranking | FarmView;
      }).then(value => { if (!controller.signal.aborted) setData(value); })
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Unable to load the farms"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account, reload]);
  useEffect(() => { setQuery(""); setFilter("all"); setPage(1); setCopied(false); }, [account]);
  useEffect(() => { setPage(1); }, [query, filter]);
  const ranking = data && "farms" in data ? data : undefined;
  const view = data && "farm" in data ? data : undefined;
  const search = query.trim().toLowerCase();
  const farms = ranking?.farms.filter(f => `${farmName(f.account)} ${f.account}`.toLowerCase().includes(search)) ?? [];
  const nfts = view?.farm.nfts.filter(n =>
    (filter === "all" || filter === n.kind || filter === n.status) &&
    `${n.nft.name} ${n.nft.id} ${n.nft.resource} ${n.kind === "canine" ? n.nft.genes : ""}`.toLowerCase().includes(search)) ?? [];
  const pageSize = account ? 12 : 20;
  const count = account ? nfts.length : farms.length;
  const maxPage = Math.max(1, Math.ceil(count / pageSize));
  const visiblePage = Math.min(page, maxPage);
  const range = <T,>(items: T[]) => items.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);
  const share = async () => {
    try { await navigator.clipboard.writeText(location.href); setCopied(true); }
    catch { setError("Could not copy the link. You can copy this page’s address instead."); }
  };
  return <section className="page-section community-page">
    <div className="community-heading">
      <div>
        {account && <a className="community-back" href="#ranking"><ArrowLeft size={16} /> Rankings</a>}
        <div className="eyebrow"><Trophy size={15} /> {account ? "OPEN FARM" : "THE ARKIMALS COMMUNITY"}</div>
        <h1>{account ? <>{farmName(account)}<span className="farm-title-note">{currentAccount === account ? "Your public farm" : "A pack worth visiting."}</span></> : <>Big packs.<br /><em>Good company.</em></>}</h1>
        {!account && <p className="section-intro">Meet the collectors. Explore their farms.</p>}
      </div>
      <div className="community-actions">
        {!account && currentAccount && <a className="secondary" href={farmHref(currentAccount)}>My farm <ArrowUpRight size={16} /></a>}
        {account && <button className="secondary" onClick={() => void share()}>{copied ? <Check size={16} /> : <Copy size={16} />}{copied ? "Link copied" : "Share farm"}</button>}
        <button className="secondary" disabled={loading} onClick={() => setReload(n => n + 1)} aria-label="Refresh farms"><RefreshCw size={16} /></button>
      </div>
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}
    {loading && <div className="community-loading" role="status"><PawPrint size={32} /> Loading the farms…</div>}
    {ranking && <>
      <div className="community-stats">
        <div><strong>{ranking.farms.length.toLocaleString()}</strong><span>Collectors</span></div>
        <div><strong>{ranking.totalNFTs.toLocaleString()}</strong><span>Game NFTs</span></div>
        <div><strong>{ranking.farms.reduce((sum, f) => sum + f.staked, 0).toLocaleString()}</strong><span>Staked canines</span></div>
      </div>
      <div className="community-toolbar">
        <h2><Trophy size={20} /> Most NFTs</h2>
        <label className="community-search"><Search size={17} /><input aria-label="Find a farm" placeholder="Find a farm…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      </div>
      <div className="ranking-list">
        {range(farms).map(f => <a key={f.account} className={"ranking-row" + (f.account === currentAccount ? " own-farm" : "")} href={farmHref(f.account)} aria-label={`Visit ${farmName(f.account)}, rank ${f.rank}, ${f.total} NFTs`}>
          <span className={"ranking-place place-" + f.rank}>#{f.rank}</span>
          <div className="ranking-pack">{f.preview.map(item => <Art key={item.nft.resource + item.nft.id} item={item} />)}</div>
          <div className="ranking-name"><h3>{farmName(f.account)} {f.account === currentAccount && <span className="pill">You</span>}</h3><p>{f.canines} canines · {f.halloween} Halloween</p></div>
          <div className="ranking-total"><strong>{f.total}</strong><span>NFTs</span></div>
          <span className="ranking-visit">Visit farm <ArrowUpRight size={18} /></span>
        </a>)}
      </div>
      {!farms.length && <div className="empty-state"><PawPrint size={36} /><h2>{query ? "No matching farms." : "The first pack is yet to arrive."}</h2><p>{query ? "Try another farm address." : "Hatch a canine to start your collection."}</p></div>}
      <details className="ranking-rules"><summary>What counts?</summary><p>Canines and Halloween NFTs from this game, including staked canines and NFTs held in unfinished breeding or rebirth. Each NFT counts once. Burned NFTs and unrelated collections do not count. Equal totals share a rank.</p><p>The directory covers wallets recorded in the game’s contracts. Current ownership is checked on Tari; a transfer-only recipient appears after participating in the game. Counts refresh at most once a minute.</p></details>
    </>}
    {view && <>
      <div className="farm-banner">
        <div className="farm-banner-pack">{view.farm.nfts.slice(0, 4).map(item => <Art key={item.nft.resource + item.nft.id} item={item} />)}</div>
        <div className="farm-banner-stats"><span className="pill">{view.rank ? `Rank #${view.rank}` : "New farm"}</span><strong>{view.farm.total} NFTs</strong><p>{view.farm.canines} canines · {view.farm.halloween} Halloween · {view.farm.staked} staked</p></div>
      </div>
      <details className="farm-address"><summary>Farm address</summary><code>{view.farm.account}</code></details>
      <div className="community-toolbar">
        <div className="farm-filters" aria-label="Collection filters">{[["all", "All NFTs"], ["canine", "Canines"], ["halloween", "Halloween"], ["staked", "Staked"]].map(([value, label]) => <button key={value} aria-pressed={filter === value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{label}</button>)}</div>
        <label className="community-search"><Search size={17} /><input aria-label="Find an NFT" placeholder="Name, genes, or ID…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      </div>
      <div className="collection-grid farm-collection">{range(nfts).map(item => <NFTCard key={item.nft.resource + item.nft.id} item={item} />)}</div>
      {!nfts.length && <div className="empty-state"><PawPrint size={36} /><h2>{view.farm.total ? "No NFTs match this view." : "Room for a new pack."}</h2><p>{view.farm.total ? "Try another filter or search." : "This farm has no game NFTs right now."}</p></div>}
    </>}
    {data && <>
      {maxPage > 1 && <div className="community-pagination"><button className="secondary" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)}>Previous</button><span>Page {visiblePage} of {maxPage}</span><button className="secondary" disabled={visiblePage === maxPage} onClick={() => setPage(visiblePage + 1)}>Next</button></div>}
      <Freshness updatedAt={data.updatedAt} stale={data.stale} />
    </>}
  </section>;
}
