import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
export class Sessions {
  constructor(private readonly secret: string) {
    if (secret.length < 64)
      throw new Error(
        "A persistent session secret of at least 64 characters is required",
      );
  }
  issue() {
    const id = randomBytes(24).toString("hex");
    return id + "." + this.mac(id);
  }
  private mac(id: string) {
    return createHmac("sha256", this.secret)
      .update("midnight-kennel/session/v1|" + id)
      .digest("hex");
  }
  read(token: unknown): string | null {
    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{48}\.[a-f0-9]{64}$/.test(token)
    )
      return null;
    const [id, signature] = token.split(".");
    return timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(this.mac(id), "hex"),
    )
      ? id
      : null;
  }
  account(id: string) {
    return (
      "kennel-visitor-" +
      createHmac("sha256", this.secret)
        .update("account|" + id)
        .digest("hex")
        .slice(0, 32)
    );
  }
}
