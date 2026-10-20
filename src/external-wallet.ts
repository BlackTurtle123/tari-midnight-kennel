import type { GameState, Opening, IncubationView } from "../shared/game";
import {
  rebirthInstructions,
  economyInstructions,
  type EconomyAction,
  type RebirthInput,
} from "../shared/rebirth";
import {
  intentId,
  playerInstructions,
  sha256,
  type WalletIntent,
} from "../shared/external-wallet";

export interface TariProvider {
  isTariWallet?: boolean;
  request<T = unknown>(request: {
    method: string;
    params?: unknown;
  }): Promise<T>;
  on?(
    event: "accountsChanged",
    callback: (accounts: string[]) => void,
  ): (() => void) | void;
}
declare global {
  interface Window {
    tari?: TariProvider;
  }
}
type Api = <T>(path: string, body?: unknown) => Promise<T>;
interface Approval {
  creating?: boolean;
  requestId?: string;
  submitted?: boolean;
  rejected?: boolean;
}
interface Saved {
  rebirth?: RebirthInput;
  economyAction?: EconomyAction;
  economySubmitted?: boolean;
  rebirthComplete?: boolean;
  revision?: number;
  id: string;
  intent: WalletIntent;
  createdAt: string;
  begin?: Approval;
  hatch?: Approval;
}
const prefix = "midnight-kennel/external/v1/";
const native = "resource_" + "01".repeat(32);

// Append-only public recovery metadata. Never store seeds, private keys or memo openings.
export function readSaved(
  storage: Storage,
  account: string,
  component: string,
): Saved[] {
  const records = new Map<string, Saved>();
  const keys = Array.from({ length: storage.length }, (_, i) => storage.key(i)!)
    .filter((k) => k.startsWith(prefix))
    .sort();
  for (const key of keys) {
    const r = JSON.parse(storage.getItem(key)!) as Saved;
    if (
      r.intent.account === account &&
      r.intent.component === component &&
      (r.revision ?? 0) >= (records.get(r.id)?.revision ?? 0)
    )
      records.set(r.id, r);
  }
  return [...records.values()];
}
function save(r: Saved) {
  r.revision = (r.revision ?? 0) + 1;
  localStorage.setItem(
    prefix +
      r.id +
      "/" +
      r.revision.toString().padStart(8, "0") +
      "/" +
      crypto.randomUUID(),
    JSON.stringify(r),
  );
}
export class ExternalWallet {
  private stopped = false;
  private unsubscribe?: () => void;
  private constructor(
    readonly provider: TariProvider,
    readonly account: string,
    readonly paymentAddress: string,
    readonly component: string,
    private api: Api,
    private invalidate: () => void,
  ) {
    const listener = () => {
      this.stop();
      invalidate();
    };
    const unsub = provider.on?.("accountsChanged", listener);
    window.addEventListener("tari#accountsChanged", listener);
    this.unsubscribe = () => {
      unsub?.();
      window.removeEventListener("tari#accountsChanged", listener);
    };
  }
  static async connect(api: Api, invalidate: () => void) {
    const p = window.tari;
    if (!p?.isTariWallet)
      throw new Error(
        "Open this page in Chrome with Sapient installed and unlocked, then connect again.",
      );
    const accounts = await p.request<string[]>({
      method: "tari_requestAccounts",
    });
    if (accounts.length !== 1 || !/^component_[a-f0-9]{64}$/.test(accounts[0]))
      throw new Error("Choose one account in Sapient");
    if ((await p.request({ method: "tari_getNetwork" })) !== "esmeralda")
      throw new Error("Switch Sapient to Esmeralda testnet before connecting");
    const caps = await p.request<Record<string, boolean>>({
      method: "tari_getCapabilities",
    });
    if (!caps.transactionRequests || !caps.walletAddress || !caps.privateScan)
      throw new Error(
        "Use an up-to-date Sapient account with its seed held locally in the extension. A daemon-relayed account cannot open this secret locally.",
      );
    const address = await p.request<string>({
      method: "tari_getWalletAddress",
    });
    if (!/^otl_esm_[a-z0-9]+$/.test(address))
      throw new Error("Invalid Esmeralda payment address");
    const config = await api<{ component: string; network: string }>(
      "/external/config",
    );
    if (config.network !== "esmeralda")
      throw new Error("Incorrect game network");
    const wallet = new ExternalWallet(
      p,
      accounts[0],
      address,
      config.component,
      api,
      invalidate,
    );
    await wallet.check();
    return wallet;
  }
  stop() {
    this.stopped = true;
    this.unsubscribe?.();
  }
  async disconnect() {
    this.stop();
    await this.provider.request({ method: "tari_disconnect" });
  }
  async check() {
    if (this.stopped)
      throw new Error(
        "Wallet connection changed. Reconnect the original account to continue.",
      );
    const accounts = await this.provider.request<string[]>({
      method: "tari_getAccounts",
    });
    const network = await this.provider.request({ method: "tari_getNetwork" });
    const address = await this.provider.request({
      method: "tari_getWalletAddress",
    });
    if (
      accounts.length !== 1 ||
      accounts[0] !== this.account ||
      network !== "esmeralda" ||
      address !== this.paymentAddress
    ) {
      this.stop();
      this.invalidate();
      throw new Error(
        "Wallet account or network changed. Reconnect to continue.",
      );
    }
    if (this.stopped) throw new Error("Wallet disconnected");
  }
  private saved() {
    return readSaved(localStorage, this.account, this.component);
  }
  private async chainState() {
    return this.api<GameState>(
      "/external/state?account=" + encodeURIComponent(this.account),
    );
  }
  async state(): Promise<GameState> {
    await this.check();
    const state = await this.chainState();
    for (const r of this.saved()) {
      if (state.incubations.some((i) => i.id === r.id)) continue;
      state.incubations.unshift({
        id: r.id,
        door: r.intent.door,
        commitment: "",
        createdAt: r.createdAt,
        stage: "starting",
        error: r.begin?.rejected
          ? "Approval declined. Check progress to request approval again."
          : "Approve the incubation in Sapient, then check progress here.",
      });
    }
    await this.check();
    return { ...state, paymentAddress: this.paymentAddress };
  }
  private async locked<T>(work: () => Promise<T>) {
    if (!navigator.locks)
      throw new Error(
        "This browser cannot safely coordinate wallet requests. Use a current Chrome browser.",
      );
    return navigator.locks.request(
      prefix + this.account,
      { ifAvailable: true },
      (lock) => {
        if (!lock)
          throw new Error("A wallet action is already running in another tab");
        return work();
      },
    );
  }
  async begin(door: number) {
    return this.locked(async () => {
      await this.check();
      if ((await this.state()).incubations.some((i) => i.stage !== "hatched"))
        throw new Error("Resume your existing incubation first");
      const intent: WalletIntent = {
        account: this.account,
        paymentAddress: this.paymentAddress,
        component: this.component,
        door,
        nonce: Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
          b.toString(16).padStart(2, "0"),
        ).join(""),
      };
      await this.api("/external/prepare", intent);
      const r: Saved = {
        id: await intentId(intent),
        intent,
        createdAt: new Date().toISOString(),
      };
      save(r); // Preserve the address binding before any wallet approval is requested.
      await this.finishBegin(r);
    });
  }
  async resume(id: string) {
    return this.locked(async () => {
      await this.check();
      const r = this.saved().find((r) => r.id === id);
      if (r) await this.finishBegin(r);
      else await this.api("/external/resume", { account: this.account, id });
    });
  }
  private async finishBegin(r: Saved) {
    await this.check();
    if (!(await this.chainState()).incubations.some((i) => i.id === r.id)) {
      await this.approve(
        r,
        "begin",
        playerInstructions(this.component, r.id, {
          kind: "begin",
          account: this.account,
          door: r.intent.door,
        }),
      );
    }
    await this.check();
    await this.api("/external/register", { intent: r.intent, id: r.id });
  }
  private async approve(
    r: Saved,
    phase: "begin" | "hatch",
    instructions: ReturnType<typeof playerInstructions>,
  ) {
    await this.check();
    let approval = r[phase];
    if (!approval || approval.rejected) {
      approval = { creating: true };
      r[phase] = approval;
      save(r);
      const created = await this.provider.request<{ requestId: string }>({
        method: "tari_createTransactionRequest",
        params: { kind: "instructions", instructions, maxFee: "1000000" },
      });
      if (typeof created.requestId !== "string" || !created.requestId)
        throw new Error(
          "Wallet did not return a request ID. No duplicate request will be sent.",
        );
      approval.requestId = created.requestId;
      approval.creating = false;
      save(r);
    }
    if (!approval.requestId)
      throw new Error(
        "Wallet request acknowledgement was lost. Recovery is required before another approval can be requested.",
      );
    const params = { requestId: approval.requestId };
    for (let i = 0; i < 45; i++) {
      await this.check();
      const record = await this.provider.request<{ status: string }>({
        method: "tari_getTransactionRequest",
        params,
      });
      if (record.status === "submitted") {
        approval.submitted = true;
        save(r);
        return;
      }
      if (record.status === "approved") {
        await this.check();
        // The durable request ID, not another transaction, is reused on lost acknowledgements.
        await this.provider.request({
          method: "tari_submitTransactionRequest",
          params,
        });
        await this.check();
        approval.submitted = true;
        save(r);
        return;
      }
      if (record.status === "rejected") {
        approval.rejected = true;
        save(r);
        throw new Error(
          "You declined the wallet approval. Nothing was submitted by this request; you can try again.",
        );
      }
      if (record.status === "failed")
        throw new Error(
          "Wallet reports a failed request. Check its transaction history; uncertain submissions need recovery before retrying.",
        );
      if (!["pending", "submitting"].includes(record.status))
        throw new Error(
          "Unknown wallet request status; request preserved for recovery",
        );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error(
      "Approval or confirmation is still pending in Sapient. Check progress to resume the same request.",
    );
  }
  async open(incubation: IncubationView): Promise<Opening> {
    await this.check();
    if (!incubation.deliveryTx)
      throw new Error("The encrypted message has not been delivered yet");
    const view = await this.provider.request<{ granted: boolean }>({
      method: "tari_requestViewAccess",
    });
    if (!view.granted)
      throw new Error(
        "Private preview needs your permission to read wallet memos. You can keep it sealed.",
      );
    await this.check();
    const scan = await this.provider.request<{
      found: { memo?: string; transactionId: string }[];
    }>({
      method: "tari_scanForResourceUtxos",
      params: {
        resourceAddress: native,
        maxPages: 10,
        pageSize: 100,
        limit: 1000,
        transactionIds: [incubation.deliveryTx],
      },
    });
    await this.check();
    for (const output of scan.found) {
      const match = /^MK2:([a-f0-9]{32}):([0-3]):([a-f0-9]{64})$/.exec(
        output.memo ?? "",
      );
      if (
        !match ||
        output.transactionId !== incubation.deliveryTx ||
        match[1] !== incubation.id
      )
        continue;
      const o = { id: match[1], variant: Number(match[2]), salt: match[3] };
      if (
        (await sha256(`midnight-kennel:v2|${o.id}|${o.variant}|${o.salt}`)) ===
        incubation.commitment
      ) {
        await this.check();
        return o;
      }
    }
    throw new Error(
      "Sapient has not found the matching encrypted memo yet. Keep it sealed and try opening it again shortly.",
    );
  }
  async hatch(opening: Opening) {
    return this.locked(async () => {
      await this.check();
      const state = await this.chainState();
      const c = state.incubations.find((i) => i.id === opening.id);
      if (!c) throw new Error("This incubation belongs to another account");
      if (c.stage === "hatched") return;
      if (
        (await sha256(
          `midnight-kennel:v2|${opening.id}|${opening.variant}|${opening.salt}`,
        )) !== c.commitment
      )
        throw new Error("Private preview does not match the sealed outcome");
      // Existing server delivery records allow recovery on another browser with the
      // same wallet. No salt is ever saved in our browser recovery metadata.
      const r = this.saved().find((r) => r.id === opening.id) ?? {
        id: opening.id,
        intent: {
          account: this.account,
          component: this.component,
          paymentAddress: this.paymentAddress,
          door: c.door,
          nonce: "",
        },
        createdAt: new Date().toISOString(),
      };
      await this.approve(
        r,
        "hatch",
        playerInstructions(this.component, opening.id, {
          kind: "hatch",
          variant: opening.variant,
          salt: opening.salt,
        }),
      );
      const latest = await this.chainState();
      if (
        !latest.incubations.some(
          (i) => i.id === opening.id && i.stage === "hatched",
        )
      )
        throw new Error(
          "Mint submitted; waiting for confirmation. Your wallet request is saved. Open the secret again to check the same mint.",
        );
    });
  }
  async act(action: EconomyAction, nonce: string) {
    return this.locked(async () => {
      await this.check();
      const state = await this.chainState(),
        config = state.rebirth;
      if (!config) throw new Error("Economy contracts are being prepared");
      if (!/^[a-f0-9]{32}$/.test(nonce))
        throw new Error("Invalid wallet request");
      const id = (
        await sha256(JSON.stringify(["economy-v1", action, nonce]))
      ).slice(0, 32);
      let r = readSaved(localStorage, this.account, config.component).find(
        (r) => r.id === id,
      );
      if (r?.economySubmitted) return;
      if (!r) {
        if (this.pendingEconomy(config).length)
          throw new Error(
            "Resume the saved wallet action before starting another",
          );
        r = {
          id,
          economyAction: action,
          intent: {
            account: this.account,
            component: config.component,
            paymentAddress: this.paymentAddress,
            door: 0,
            nonce,
          },
          createdAt: new Date().toISOString(),
        };
        save(r);
      }
      await this.approve(
        r,
        "hatch",
        economyInstructions(config, this.account, action),
      );
      r.economySubmitted = true;
      save(r);
    });
  }
  pendingEconomy(config: { component: string }) {
    return readSaved(localStorage, this.account, config.component)
      .filter((r) => r.economyAction && !r.economySubmitted)
      .map((r) => ({ action: r.economyAction!, nonce: r.intent.nonce }));
  }
  async rebirth(input: RebirthInput) {
    return this.act(
      { kind: "begin", resource: input.resource, id: input.id },
      (await sha256(input.resource + input.id)).slice(0, 32),
    );
  }

  pendingRebirths(config: { component: string }) {
    return readSaved(localStorage, this.account, config.component)
      .filter((r) => r.rebirth && !r.rebirthComplete)
      .map((r) => r.rebirth!);
  }
}
