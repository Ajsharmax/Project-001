import { createRemoteJWKSet, jwtVerify } from "jose";

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    },
  });
const fail = (status, message) => {
  throw Object.assign(new Error(message), { status });
};
const text = (value, max = 200) =>
  String(value ?? "")
    .trim()
    .slice(0, max);
export function httpsUrl(value) {
  if (!value) return "";
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(400, "Enter a valid HTTPS URL.");
  }
  if (url.protocol !== "https:" || url.username || url.password)
    fail(400, "Use an HTTPS URL without credentials.");
  return url.href;
}
export function validateItem(body) {
  const item = {
    id: text(body.id) || crypto.randomUUID(),
    kind: body.kind,
    name: text(body.name, 100),
    description: text(body.description, 2000),
    category: text(body.category, 60),
    price_paise: Number(body.price_paise),
    stock: Number(body.stock ?? 0),
    duration_days: Number(body.duration_days ?? 30),
    image_url: httpsUrl(body.image_url),
    external_url: httpsUrl(body.external_url),
    active: body.active === true ? 1 : 0,
  };
  if (
    !["product", "plan"].includes(item.kind) ||
    !item.name ||
    !/^[\w-]{1,100}$/.test(item.id)
  )
    fail(400, "Name and valid item type are required.");
  if (
    !Number.isSafeInteger(item.price_paise) ||
    item.price_paise < 100 ||
    item.price_paise > 10000000
  )
    fail(400, "Price must be between ₹1 and ₹100,000.");
  if (
    !Number.isSafeInteger(item.stock) ||
    item.stock < 0 ||
    item.stock > 100000 ||
    !Number.isInteger(item.duration_days) ||
    item.duration_days < 1 ||
    item.duration_days > 366
  )
    fail(400, "Check stock and membership duration.");
  return item;
}
async function bodyOf(request) {
  const raw = await request.text();
  if (raw.length > 16000) fail(413, "Request too large.");
  try {
    return JSON.parse(raw);
  } catch {
    fail(400, "Invalid request.");
  }
}
const keys = new Map();
async function admin(request, env) {
  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD || !env.ADMIN_EMAIL)
    fail(503, "Admin sign-in is not configured yet.");
  const issuer = `https://${env.ACCESS_TEAM_DOMAIN}`;
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_TEAM_DOMAIN))
    fail(503, "Admin configuration needs attention.");
  if (!keys.has(issuer))
    keys.set(
      issuer,
      createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`)),
    );
  try {
    const { payload } = await jwtVerify(
      request.headers.get("Cf-Access-Jwt-Assertion") || "",
      keys.get(issuer),
      { issuer, audience: env.ACCESS_AUD, algorithms: ["RS256"] },
    );
    if (
      typeof payload.email !== "string" ||
      payload.email.toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()
    )
      fail(403, "Administrator access required.");
    return payload.email;
  } catch {
    fail(403, "Sign in through Cloudflare Access to manage your store.");
  }
}
async function settings(db) {
  const row = await db
    .prepare("SELECT value FROM settings WHERE id = 1")
    .first();
  return row
    ? JSON.parse(row.value)
    : {
        businessName: "Markettech",
        supportEmail: "",
        shipping: "",
        returns: "",
        terms: "",
        checkoutEnabled: false,
      };
}
function gatewayReady(env, config) {
  return (
    config.checkoutEnabled &&
    config.supportEmail &&
    config.shipping &&
    config.returns &&
    config.terms &&
    env.YOUPI_API_URL &&
    env.YOUPI_CHECKOUT_ORIGIN &&
    env.YOUPI_MERCHANT_ID &&
    env.YOUPI_WEBHOOK_SECRET
  );
}
export async function verifyWebhook(raw, signature, secret) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature || "")) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const bytes = Uint8Array.from(signature.slice(7).match(/../g), (h) =>
    parseInt(h, 16),
  );
  return crypto.subtle.verify(
    "HMAC",
    key,
    bytes,
    new TextEncoder().encode(raw),
  );
}
async function handle(request, env) {
  const url = new URL(request.url),
    path = url.pathname;
  if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
  if (path === "/api/health")
    return json({
      status: "ok",
      database: !!env.DB,
      paymentsConfigured: !!(env.YOUPI_API_URL && env.YOUPI_WEBHOOK_SECRET),
    });
  if (
    request.method !== "GET" &&
    path !== "/api/payments/webhook" &&
    request.headers.get("Origin") !== url.origin
  )
    fail(403, "Cross-site request rejected.");
  if (!env.DB) {
    if (path === "/api/catalog")
      return json({
        items: [],
        settings: { businessName: "Markettech", checkoutEnabled: false },
        checkoutReady: false,
      });
    fail(
      503,
      "Store database is not connected yet. The free tools are available.",
    );
  }
  const db = env.DB;
  if (path === "/api/catalog" && request.method === "GET") {
    const config = await settings(db);
    const { results } = await db
      .prepare("SELECT * FROM items WHERE active = 1 ORDER BY created_at DESC")
      .all();
    return json({
      items: results,
      settings: config,
      checkoutReady: !!gatewayReady(env, config),
    });
  }
  if (path.startsWith("/api/admin/")) {
    const email = await admin(request, env);
    if (path === "/api/admin/dashboard" && request.method === "GET") {
      const [items, orders, config] = await Promise.all([
        db.prepare("SELECT * FROM items ORDER BY created_at DESC").all(),
        db
          .prepare(
            "SELECT id, item_name, kind, amount_paise, status, customer_name, email, phone, address, created_at, paid_at, membership_until, fulfillment, tracking_url FROM orders ORDER BY created_at DESC LIMIT 200",
          )
          .all(),
        settings(db),
      ]);
      return json({
        email,
        items: items.results,
        orders: orders.results,
        settings: config,
        gatewayConfigured: !!(
          env.YOUPI_API_URL &&
          env.YOUPI_MERCHANT_ID &&
          env.YOUPI_WEBHOOK_SECRET &&
          env.YOUPI_CHECKOUT_ORIGIN
        ),
      });
    }
    if (path === "/api/admin/items" && request.method === "POST") {
      const item = validateItem(await bodyOf(request));
      await db
        .prepare(
          "INSERT INTO items (id,kind,name,description,category,price_paise,stock,duration_days,image_url,external_url,active) VALUES (?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,description=excluded.description,category=excluded.category,price_paise=excluded.price_paise,stock=excluded.stock,duration_days=excluded.duration_days,image_url=excluded.image_url,external_url=excluded.external_url,active=excluded.active",
        )
        .bind(...Object.values(item))
        .run();
      return json({ saved: true });
    }
    if (path === "/api/admin/settings" && request.method === "POST") {
      const b = await bodyOf(request);
      const config = {
        businessName: text(b.businessName, 100) || "Markettech",
        supportEmail: text(b.supportEmail, 254),
        shipping: text(b.shipping, 3000),
        returns: text(b.returns, 3000),
        terms: text(b.terms, 3000),
        checkoutEnabled: b.checkoutEnabled === true,
      };
      if (
        config.supportEmail &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(config.supportEmail)
      )
        fail(400, "Enter a valid support email.");
      if (config.checkoutEnabled && !gatewayReady(env, config))
        fail(
          400,
          "Configure the gateway, support email, shipping, returns and terms before enabling checkout.",
        );
      await db
        .prepare(
          "INSERT INTO settings(id,value) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value",
        )
        .bind(JSON.stringify(config))
        .run();
      return json({ saved: true });
    }
    if (path === "/api/admin/fulfillment" && request.method === "POST") {
      const b = await bodyOf(request);
      if (
        !["unfulfilled", "processing", "shipped", "delivered"].includes(
          b.fulfillment,
        )
      )
        fail(400, "Invalid fulfillment status.");
      const result = await db
        .prepare(
          "UPDATE orders SET fulfillment=?,tracking_url=? WHERE id=? AND status='paid' AND kind='product'",
        )
        .bind(b.fulfillment, httpsUrl(b.tracking_url), text(b.id))
        .run();
      if (!result.meta.changes)
        fail(400, "Only paid product orders can be fulfilled.");
      return json({ saved: true });
    }
    fail(404, "Not found.");
  }
  if (path === "/api/checkout" && request.method === "POST") {
    const config = await settings(db);
    if (!gatewayReady(env, config)) fail(503, "Checkout is not open yet.");
    const b = await bodyOf(request);
    const item = await db
      .prepare("SELECT * FROM items WHERE id=? AND active=1")
      .bind(text(b.itemId))
      .first();
    if (!item || item.external_url)
      fail(400, "This item is unavailable for direct checkout.");
    const customer = {
      name: text(b.name, 100),
      email: text(b.email, 254),
      phone: text(b.phone, 20),
      address: text(b.address, 1500),
    };
    if (
      !customer.name ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
      !/^[6-9]\d{9}$/.test(customer.phone) ||
      (item.kind === "product" && customer.address.length < 15) ||
      b.accepted !== true
    )
      fail(
        400,
        "Complete your contact details, delivery address and acceptance of the store terms.",
      );
    // Fixed per-IP hourly limit. Only a SHA-256 digest is retained for abuse prevention.
    const digest = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(
        `${request.headers.get("CF-Connecting-IP") || "local"}:${Math.floor(Date.now() / 3600000)}`,
      ),
    );
    const rateKey = Array.from(new Uint8Array(digest), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
    const rate = await db
      .prepare(
        "INSERT INTO rate_limits(id,count,expires) VALUES(?,1,?) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count",
      )
      .bind(rateKey, Date.now() + 7200000)
      .first();
    if (rate.count > 10)
      fail(429, "Too many checkout attempts. Please try again later.");
    await db
      .prepare("DELETE FROM rate_limits WHERE expires < ?")
      .bind(Date.now())
      .run();
    const id = crypto.randomUUID(),
      token = crypto.randomUUID();
    if (item.kind === "product") {
      const reserved = await db
        .prepare("UPDATE items SET stock=stock-1 WHERE id=? AND stock>0")
        .bind(item.id)
        .run();
      if (!reserved.meta.changes) fail(409, "This product is out of stock.");
    }
    try {
      await db
        .prepare(
          "INSERT INTO orders(id,token,item_id,item_name,kind,amount_paise,duration_days,customer_name,email,phone,address) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        )
        .bind(
          id,
          token,
          item.id,
          item.name,
          item.kind,
          item.price_paise,
          item.duration_days,
          customer.name,
          customer.email,
          customer.phone,
          customer.address,
        )
        .run();
    } catch (e) {
      if (item.kind === "product")
        await db
          .prepare("UPDATE items SET stock=stock+1 WHERE id=?")
          .bind(item.id)
          .run();
      throw e;
    }
    try {
      const response = await fetch(
        `${httpsUrl(env.YOUPI_API_URL).replace(/\/$/, "")}/api/v1/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Merchant-Id": env.YOUPI_MERCHANT_ID,
            "Idempotency-Key": id,
          },
          body: JSON.stringify({
            orderId: id,
            amount: (item.price_paise / 100).toFixed(2),
            currency: "INR",
            returnUrl: `${url.origin}/#order/${id}`,
            metadata: { itemId: item.id },
          }),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) throw new Error("Gateway unavailable");
      const payment = await response.json();
      const checkoutUrl = new URL(httpsUrl(payment.checkoutUrl));
      if (
        checkoutUrl.origin !==
          new URL(httpsUrl(env.YOUPI_CHECKOUT_ORIGIN)).origin ||
        typeof payment.paymentId !== "string"
      )
        throw new Error("Invalid gateway response");
      await db
        .prepare("UPDATE orders SET payment_id=?,checkout_url=? WHERE id=?")
        .bind(payment.paymentId, checkoutUrl.href, id)
        .run();
      return json({ id, token, checkoutUrl: checkoutUrl.href }, 201);
    } catch {
      // Do not restock ambiguous gateway timeouts: a live payment may have been created.
      await db
        .prepare(
          "UPDATE orders SET status='review' WHERE id=? AND status='pending'",
        )
        .bind(id)
        .run();
      fail(
        502,
        "Payment setup needs review. No payment has been confirmed. Contact support before retrying.",
      );
    }
  }
  if (path.startsWith("/api/orders/") && request.method === "GET") {
    const row = await db
      .prepare(
        "SELECT id,item_name,kind,amount_paise,status,membership_until,fulfillment,tracking_url FROM orders WHERE id=? AND token=?",
      )
      .bind(
        path.split("/").pop(),
        request.headers.get("Authorization")?.replace(/^Bearer /, "") || "",
      )
      .first();
    if (!row)
      fail(
        404,
        "Order not found on this device. Contact support with your order reference.",
      );
    return json(row);
  }
  if (path === "/api/payments/webhook" && request.method === "POST") {
    const raw = await request.text();
    if (
      raw.length > 16000 ||
      !(await verifyWebhook(
        raw,
        request.headers.get("X-Gateway-Signature"),
        env.YOUPI_WEBHOOK_SECRET,
      ))
    )
      fail(401, "Invalid signature.");
    let event;
    try {
      event = JSON.parse(raw);
    } catch {
      fail(400, "Invalid payload.");
    }
    const order = await db
      .prepare("SELECT * FROM orders WHERE id=?")
      .bind(text(event.orderId))
      .first();
    if (!order) fail(404, "Unknown order.");
    if (event.event !== "SUCCESS") return json({ received: true });
    if (
      Number(event.amountPaise) !== order.amount_paise ||
      !/^\d{12}$/.test(String(event.utr)) ||
      !order.payment_id ||
      event.paymentId !== order.payment_id
    )
      fail(409, "Payment does not match the order.");
    if (order.status === "paid") return json({ received: true });
    const until =
      order.kind === "plan"
        ? new Date(Date.now() + order.duration_days * 86400000).toISOString()
        : null;
    await db
      .prepare(
        "UPDATE orders SET status='paid',utr=?,paid_at=datetime('now'),membership_until=? WHERE id=? AND status IN ('pending','review')",
      )
      .bind(String(event.utr), until, order.id)
      .run();
    return json({ received: true });
  }
  fail(404, "Not found.");
}
export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (e) {
      return json(
        {
          error: e.status
            ? e.message
            : "The store is temporarily unavailable. Please try again later.",
        },
        e.status || 500,
      );
    }
  },
};
