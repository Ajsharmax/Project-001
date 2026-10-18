import { describe, it, expect, vi, afterEach } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
// The edge entry point is JavaScript so it can also be deployed without a TS runtime.
// @ts-expect-error JavaScript module is exercised by these integration tests.
import worker, { validateItem, verifyWebhook } from "../server/worker.js";
function database() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync("migrations/0001_store.sql", "utf8"));
  return {
    prepare(sql: string) {
      let args: unknown[] = [];
      return {
        bind(...values: unknown[]) {
          args = values;
          return this;
        },
        async first() {
          return sqlite.prepare(sql).get(...(args as never[])) || null;
        },
        async all() {
          return { results: sqlite.prepare(sql).all(...(args as never[])) };
        },
        async run() {
          const result = sqlite.prepare(sql).run(...(args as never[]));
          return { meta: { changes: Number(result.changes) } };
        },
      };
    },
  };
}
async function sign(raw: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("test-secret"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return (
    "sha256=" +
    Array.from(
      new Uint8Array(
        await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)),
      ),
      (b) => b.toString(16).padStart(2, "0"),
    ).join("")
  );
}
const origin = "https://soft.markettech.in";
const request = (
  path: string,
  body?: unknown,
  headers: Record<string, string> = {},
) =>
  new Request(origin + path, {
    method: body === undefined ? "GET" : "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    ...(body === undefined
      ? {}
      : { body: typeof body === "string" ? body : JSON.stringify(body) }),
  });
afterEach(() => vi.unstubAllGlobals());
describe("Store boundaries", () => {
  it("rejects unsafe URLs, invalid prices and stock", () => {
    const item = {
      kind: "product",
      name: "Bowl",
      price_paise: 10000,
      stock: 1,
    };
    expect(() =>
      validateItem({ ...item, image_url: "javascript:alert(1)" }),
    ).toThrow();
    expect(() => validateItem({ ...item, price_paise: -1 })).toThrow();
    expect(() => validateItem({ ...item, stock: 0.2 })).toThrow();
    expect(validateItem(item).active).toBe(0);
  });
  it("fails closed without database or administrator configuration", async () => {
    expect((await worker.fetch(request("/api/catalog"), {})).status).toBe(200);
    expect(
      (await worker.fetch(request("/api/admin/dashboard"), { DB: database() }))
        .status,
    ).toBe(503);
    expect(
      (
        await worker.fetch(
          request("/api/checkout", {}, { Origin: "https://attacker.example" }),
          { DB: database() },
        )
      ).status,
    ).toBe(403);
  });
  it("verifies exact raw payload and rejects tampering", async () => {
    const raw = '{"event":"SUCCESS"}';
    const signature = await sign(raw);
    expect(await verifyWebhook(raw, signature, "test-secret")).toBe(true);
    expect(await verifyWebhook(raw + " ", signature, "test-secret")).toBe(
      false,
    );
    expect(await verifyWebhook(raw, signature, "wrong")).toBe(false);
  });
  it("uses server price, reserves stock and only marks a matching signed payment paid", async () => {
    const DB = database();
    await DB.prepare(
      "INSERT INTO items(id,kind,name,description,category,price_paise,stock,active) VALUES('bowl','product','Bowl','','Kitchen',12000,1,1)",
    ).run();
    await DB.prepare("INSERT INTO settings VALUES(1,?)")
      .bind(
        JSON.stringify({
          checkoutEnabled: true,
          supportEmail: "owner@example.com",
          shipping: "Ships in India",
          returns: "Contact support",
          terms: "Terms",
        }),
      )
      .run();
    const env = {
      DB,
      YOUPI_API_URL: "https://api.example.com",
      YOUPI_CHECKOUT_ORIGIN: "https://pay.example.com",
      YOUPI_MERCHANT_ID: "merchant",
      YOUPI_WEBHOOK_SECRET: "test-secret",
    };
    const upstream = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(init.body as string).amount).toBe("120.00");
      return Response.json({
        paymentId: "payment-1",
        checkoutUrl: "https://pay.example.com/checkout/1",
      });
    });
    vi.stubGlobal("fetch", upstream);
    const buyer = {
      itemId: "bowl",
      amount: 1,
      name: "Customer",
      email: "buyer@example.com",
      phone: "9876543210",
      address: "Test street, Delhi 110001",
      accepted: true,
    };
    const result = await worker.fetch(request("/api/checkout", buyer), env);
    expect(result.status).toBe(201);
    const order = await result.json();
    expect(
      (await worker.fetch(request("/api/checkout", buyer), env)).status,
    ).toBe(409);
    expect(
      (await worker.fetch(request("/api/orders/" + order.id), env)).status,
    ).toBe(404);
    const bad = JSON.stringify({
      event: "SUCCESS",
      orderId: order.id,
      paymentId: "payment-1",
      amountPaise: 1,
      utr: "123456789012",
    });
    expect(
      (
        await worker.fetch(
          request("/api/payments/webhook", bad, {
            "X-Gateway-Signature": await sign(bad),
          }),
          env,
        )
      ).status,
    ).toBe(409);
    const good = JSON.stringify({
      event: "SUCCESS",
      orderId: order.id,
      paymentId: "payment-1",
      amountPaise: 12000,
      utr: "123456789012",
    });
    expect(
      (
        await worker.fetch(
          request("/api/payments/webhook", good, {
            "X-Gateway-Signature": await sign(good),
          }),
          env,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await worker.fetch(
          request("/api/payments/webhook", good, {
            "X-Gateway-Signature": await sign(good),
          }),
          env,
        )
      ).status,
    ).toBe(200);
    const status = await worker.fetch(
      request("/api/orders/" + order.id, undefined, {
        Authorization: "Bearer " + order.token,
      }),
      env,
    );
    expect((await status.json()).status).toBe("paid");
    expect(
      (await DB.prepare("SELECT stock FROM items WHERE id='bowl'").first())!
        .stock,
    ).toBe(0);
  });
});
