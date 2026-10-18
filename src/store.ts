import "./store.css";
type Item = {
  id: string;
  kind: "product" | "plan";
  name: string;
  description: string;
  category: string;
  price_paise: number;
  stock: number;
  duration_days: number;
  image_url: string;
  external_url: string;
  active: number;
};
const escape = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const money = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
    v / 100,
  );
const safeUrl = (v: string) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" ? u.href : "";
  } catch {
    return "";
  }
};
async function api(path: string, body?: unknown, token?: string) {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw Error("The store service is not available in this preview.");
  }
  if (!response.ok)
    throw Error(data.error || "Unable to complete this request.");
  return data;
}
export function initStore() {
  const main = document.querySelector("main")!;
  const section = document.createElement("section");
  section.className = "section marketplace";
  section.id = "shop";
  section.innerHTML = `<div class="section-top"><div><div class="eyebrow">THE MARKETTECH COLLECTION</div><h2>Useful at work.<br>Thoughtful at home.</h2><p>Kitchen essentials and everyday household finds, all in one place.</p></div><span class="shop-symbol" aria-hidden="true">⌂</span></div><div id="shop-items" class="store-grid"><p class="empty-state">Loading the collection…</p></div>`;
  document.querySelector("#about")!.before(section);
  const plans = document.createElement("section");
  plans.id = "membership";
  plans.className = "section membership";
  plans.innerHTML = `<div class="eyebrow">CHOOSE WHAT WORKS FOR YOU</div><h2>Free tools. More possibilities.</h2><p>Your everyday PDF toolkit stays free. Optional memberships will appear here when available.</p><div class="store-grid" id="plan-items"><article class="plan-card"><span class="badge">ALWAYS AVAILABLE</span><h3>Everyday tools</h3><div class="price">Free</div><p>All 12 PDF tools. Local document processing. No account required.</p><a class="button" href="#applications">Explore free tools ↗</a></article></div>`;
  section.after(plans);
  const policies = document.createElement("section");
  policies.id = "store-policies";
  policies.className = "section store-policies";
  policies.innerHTML =
    '<h2>Shopping information</h2><div id="policy-content"><p>Direct checkout is not open yet. Products and shopping policies will be published before orders are accepted.</p></div>';
  main.append(policies);
  const order = document.createElement("section");
  order.id = "order-status";
  order.className = "section";
  order.hidden = true;
  main.append(order);
  const admin = document.createElement("section");
  admin.id = "admin";
  admin.className = "section admin";
  admin.hidden = true;
  main.append(admin);
  const checkout = document.createElement("dialog");
  checkout.id = "checkout";
  checkout.setAttribute("aria-labelledby", "checkout-title");
  document.body.append(checkout);
  let catalog: {
    items: Item[];
    checkoutReady: boolean;
    settings: Record<string, string>;
  } = { items: [], checkoutReady: false, settings: {} };
  const renderCard = (item: Item) =>
    `<article class="product-card">${item.image_url && safeUrl(item.image_url) ? `<img src="${escape(safeUrl(item.image_url))}" alt="${escape(item.name)}" loading="lazy" referrerpolicy="no-referrer">` : `<div class="product-placeholder" aria-hidden="true">${item.kind === "plan" ? "✦" : "⌂"}</div>`}<div class="product-content"><span class="badge">${escape(item.category || (item.kind === "plan" ? "Membership" : "Home essentials"))}</span><h3>${escape(item.name)}</h3><p>${escape(item.description)}</p><div class="price">${money(item.price_paise)}${item.kind === "plan" ? `<small> / ${item.duration_days} days</small>` : ""}</div>${item.kind === "plan" ? '<p class="fine-print">One-time payment. Renew manually; no automatic debit.</p>' : ""}${item.external_url && safeUrl(item.external_url) ? `<a class="button" href="${escape(safeUrl(item.external_url))}" target="_blank" rel="noopener noreferrer">View on marketplace ↗</a>` : `<button class="button" data-buy="${escape(item.id)}" ${!catalog.checkoutReady || (item.kind === "product" && !item.stock) ? "disabled" : ""}>${!catalog.checkoutReady ? "Checkout opening soon" : item.kind === "product" && !item.stock ? "Out of stock" : item.kind === "plan" ? "Choose membership" : "Buy with UPI"}</button>`}</div></article>`;
  async function loadCatalog() {
    try {
      catalog = await api("/api/catalog");
      const products = catalog.items.filter((x) => x.kind === "product");
      document.querySelector("#shop-items")!.innerHTML = products.length
        ? products.map(renderCard).join("")
        : '<div class="empty-state"><span aria-hidden="true">↗</span><h3>A little something for your everyday.</h3><p>Our kitchen and home collection is on its way. In the meantime, make light work of your documents with our free tools.</p><a class="text-link" href="#applications">Try a free tool →</a></div>';
      document.querySelectorAll(".paid-plan").forEach((x) => x.remove());
      for (const item of catalog.items.filter((x) => x.kind === "plan"))
        document
          .querySelector("#plan-items")!
          .insertAdjacentHTML(
            "beforeend",
            `<div class="paid-plan">${renderCard(item)}</div>`,
          );
      const s = catalog.settings;
      if (s.shipping || s.returns || s.terms)
        document.querySelector("#policy-content")!.innerHTML =
          [
            ["Shipping", s.shipping],
            ["Returns and refunds", s.returns],
            ["Terms and membership benefits", s.terms],
          ]
            .filter((x) => x[1])
            .map(
              ([name, value]) =>
                `<details><summary>${name}</summary><p class="preserve-lines">${escape(value)}</p></details>`,
            )
            .join("") +
          (s.supportEmail
            ? `<p>Questions? <a href="mailto:${escape(s.supportEmail)}">${escape(s.supportEmail)}</a></p>`
            : "");
    } catch {
      document.querySelector("#shop-items")!.innerHTML =
        '<div class="empty-state"><h3>The collection is coming soon.</h3><p>Our free tools are ready to use while we prepare the shop.</p><a class="text-link" href="#applications">Explore tools →</a></div>';
    }
  }
  main.addEventListener("click", (e) => {
    const id = (e.target as HTMLElement).closest<HTMLElement>("[data-buy]")
      ?.dataset.buy;
    const item = catalog.items.find((x) => x.id === id);
    if (!item) return;
    checkout.innerHTML = `<div class="dialog-top"><span class="eyebrow">SECURE CHECKOUT</span><button type="button" id="checkout-close" aria-label="Close checkout">✕</button></div><h2 id="checkout-title">${escape(item.name)}</h2><p>${money(item.price_paise)} · ${item.kind === "plan" ? `${item.duration_days} days, no automatic renewal` : "One item"}</p><form id="checkout-form"><label>Full name<input name="name" autocomplete="name" maxlength="100" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Mobile number<input name="phone" type="tel" inputmode="numeric" pattern="[6-9][0-9]{9}" autocomplete="tel-national" placeholder="10-digit Indian mobile" required></label>${item.kind === "product" ? '<label>Delivery address, city, state and PIN code<textarea name="address" autocomplete="street-address" minlength="15" maxlength="1500" required></textarea></label>' : ""}<label class="confirm"><input type="checkbox" name="accepted" required>I agree to the <a href="#store-policies" id="checkout-terms">store terms, shipping and refund policies</a>.</label><p class="fine-print">Contact details are stored with your order. You will continue to the payment provider to pay; a return to this website alone does not confirm payment.</p><button class="button" type="submit">Continue to UPI →</button><p id="checkout-message" role="status"></p></form>`;
    checkout.showModal();
    checkout
      .querySelector("#checkout-close")!
      .addEventListener("click", () => checkout.close());
    checkout
      .querySelector("#checkout-terms")!
      .addEventListener("click", () => checkout.close());
    checkout
      .querySelector("form")!
      .addEventListener("submit", async (event) => {
        event.preventDefault();
        const button = checkout.querySelector<HTMLButtonElement>(
          "button[type=submit]",
        )!;
        button.disabled = true;
        const data = Object.fromEntries(
          new FormData(event.target as HTMLFormElement),
        );
        try {
          const result = await api("/api/checkout", {
            ...data,
            itemId: item.id,
            accepted: data.accepted === "on",
          });
          sessionStorage.setItem(`order:${result.id}`, result.token);
          location.assign(result.checkoutUrl);
        } catch (error) {
          checkout.querySelector("#checkout-message")!.textContent = (
            error as Error
          ).message;
          button.disabled = false;
        }
      });
  });
  async function showOrder(id: string) {
    order.hidden = false;
    order.innerHTML =
      '<h2>Your order</h2><p role="status">Checking payment confirmation…</p>';
    order.scrollIntoView();
    try {
      const result = await api(
        `/api/orders/${encodeURIComponent(id)}`,
        undefined,
        sessionStorage.getItem(`order:${id}`) || "",
      );
      order.innerHTML = `<div class="eyebrow">ORDER ${escape(result.id)}</div><h2>${result.status === "paid" ? "Payment confirmed" : result.status === "review" ? "Payment needs review" : "Awaiting payment confirmation"}</h2><p>${escape(result.item_name)} · ${money(result.amount_paise)}</p><p>${result.status === "paid" ? "Thank you. Your payment was verified by the server." : "If you have already paid, please do not pay again. Refresh the status or contact support with this reference."}</p>${result.membership_until ? `<p>Membership valid until ${escape(new Date(result.membership_until).toLocaleDateString())}.</p>` : ""}<p>Fulfillment: ${escape(result.fulfillment)}</p>${safeUrl(result.tracking_url) ? `<a href="${escape(safeUrl(result.tracking_url))}" rel="noopener noreferrer" target="_blank">Track delivery ↗</a>` : ""}<button id="refresh-order" class="button">Refresh status</button>`;
      order
        .querySelector("#refresh-order")!
        .addEventListener("click", () => void showOrder(id));
    } catch (e) {
      order.innerHTML = `<h2>Your order</h2><p>${escape((e as Error).message)}</p><p>Reference: ${escape(id)}</p>`;
    }
  }
  async function showAdmin() {
    admin.hidden = false;
    admin.innerHTML =
      '<h2>Store administration</h2><p role="status">Checking your access…</p>';
    admin.scrollIntoView();
    try {
      const data = await api("/api/admin/dashboard");
      admin.innerHTML = `<div class="eyebrow">MARKETTECH / ADMIN</div><h2>Your store, at a glance.</h2><p>Signed in as ${escape(data.email)}. <a class="text-link" href="/cdn-cgi/access/logout">Sign out</a></p><div class="admin-stats"><span><strong>${data.items.length}</strong> Products & plans</span><span><strong>${data.orders.filter((x: { status: string }) => x.status === "paid").length}</strong> Paid orders (latest 200)</span><span><strong>${data.gatewayConfigured ? "Connected" : "Not configured"}</strong> Payment gateway</span></div><div class="admin-grid"><section><h3>Products & memberships</h3><p>Create a draft, then publish when ready. Marketplace links open the existing listing.</p><select id="edit-item" aria-label="Choose item to edit"><option value="">Add a new item</option>${data.items.map((x: Item) => `<option value="${escape(x.id)}">${escape(x.name)} ${x.active ? "(published)" : "(draft)"}</option>`).join("")}</select><form id="item-form"><input type="hidden" name="id"><label>Type<select name="kind"><option value="product">Product</option><option value="plan">Membership plan</option></select></label><label>Name<input name="name" maxlength="100" required></label><label>Description / included benefits<textarea name="description" maxlength="2000" required></textarea></label><label>Category<input name="category" placeholder="Kitchen, home, membership…"></label><label>Price (₹)<input name="price" type="number" min="1" max="100000" step="0.01" required></label><label>Stock (products)<input name="stock" type="number" min="0" value="0" required></label><label>Duration in days (memberships)<input name="duration_days" type="number" min="1" max="366" value="30" required></label><label>Image URL (HTTPS)<input name="image_url" type="url"></label><label>Flipkart / Meesho / external listing URL (optional)<input name="external_url" type="url"></label><label class="confirm"><input name="active" type="checkbox">Publish this item</label><button class="button" type="submit">Save item</button><p role="status"></p></form></section><section><h3>Business & checkout settings</h3><form id="settings-form"><label>Business name<input name="businessName" value="${escape(data.settings.businessName)}" required></label><label>Support email<input name="supportEmail" type="email" value="${escape(data.settings.supportEmail)}"></label>${[
        ["shipping", "Shipping policy"],
        ["returns", "Returns and refund policy"],
        ["terms", "Terms and membership benefits"],
      ]
        .map(
          ([key, label]) =>
            `<label>${label}<textarea name="${key}" maxlength="3000">${escape(data.settings[key])}</textarea></label>`,
        )
        .join(
          "",
        )}<label class="confirm"><input type="checkbox" name="checkoutEnabled" ${data.settings.checkoutEnabled ? "checked" : ""}>Enable direct checkout</label><p class="fine-print">Requires configured gateway credentials and completed business policies. Memberships use one-time UPI payments with manual renewal.</p><button class="button" type="submit">Save settings</button><p role="status"></p></form></section></div><h3>Recent orders & memberships</h3><p>Payment status changes only after a verified payment notification. Refunds and unresolved payments must be reconciled with your bank/gateway.</p><div class="orders-list">${data.orders.length ? data.orders.map((o: Record<string, string | number>) => `<article class="order-card"><h4>${escape(o.item_name)} · ${money(Number(o.amount_paise))}</h4><p>${escape(o.id)} · ${escape(o.status)} · ${escape(o.created_at)}</p><p>${escape(o.customer_name)} · ${escape(o.email)} · ${escape(o.phone)}</p><p>${escape(o.address)}</p>${o.membership_until ? `<p>Membership ends ${escape(o.membership_until)}</p>` : ""}${o.status === "paid" && o.kind === "product" ? `<form class="fulfillment-form"><input type="hidden" name="id" value="${escape(o.id)}"><label>Fulfillment<select name="fulfillment">${["unfulfilled", "processing", "shipped", "delivered"].map((s) => `<option ${o.fulfillment === s ? "selected" : ""}>${s}</option>`).join("")}</select></label><label>Tracking URL<input name="tracking_url" type="url" value="${escape(o.tracking_url)}"></label><button class="button">Update delivery</button><p role="status"></p></form>` : ""}</article>`).join("") : '<p class="empty-state">No orders yet. Your first order will appear here.</p>'}</div>`;
      const itemForm = admin.querySelector<HTMLFormElement>("#item-form")!;
      admin.querySelector("#edit-item")!.addEventListener("change", (e) => {
        itemForm.reset();
        const item = data.items.find(
          (x: Item) => x.id === (e.target as HTMLSelectElement).value,
        );
        if (!item) return;
        for (const [key, value] of Object.entries(item)) {
          const field = itemForm.elements.namedItem(
            key,
          ) as HTMLInputElement | null;
          if (field) {
            if (field.type === "checkbox") field.checked = !!value;
            else field.value = String(value);
          }
        }
        (itemForm.elements.namedItem("price") as HTMLInputElement).value = (
          item.price_paise / 100
        ).toFixed(2);
      });
      const bind = (
        form: HTMLFormElement,
        path: string,
        convert: (b: Record<string, FormDataEntryValue>) => unknown,
      ) =>
        form.addEventListener("submit", async (e) => {
          e.preventDefault();
          const button = form.querySelector<HTMLButtonElement>("button")!;
          button.disabled = true;
          try {
            await api(path, convert(Object.fromEntries(new FormData(form))));
            form.querySelector("[role=status]")!.textContent =
              "Saved successfully.";
            await loadCatalog();
          } catch (err) {
            form.querySelector("[role=status]")!.textContent = (
              err as Error
            ).message;
          } finally {
            button.disabled = false;
          }
        });
      bind(itemForm, "/api/admin/items", (b) => ({
        ...b,
        price_paise: Math.round(Number(b.price) * 100),
        active: b.active === "on",
      }));
      bind(
        admin.querySelector("#settings-form")!,
        "/api/admin/settings",
        (b) => ({ ...b, checkoutEnabled: b.checkoutEnabled === "on" }),
      );
      admin
        .querySelectorAll<HTMLFormElement>(".fulfillment-form")
        .forEach((f) => bind(f, "/api/admin/fulfillment", (b) => b));
    } catch (e) {
      admin.innerHTML = `<h2>Store administration</h2><p>${escape((e as Error).message)}</p><p>Only the owner can access products, orders and settings.</p><a class="button" href="/admin">Open secure admin sign-in</a>`;
    }
  }
  function route() {
    const match = location.hash.match(/^#order\/([\w-]+)$/);
    if (match) void showOrder(match[1]);
    else order.hidden = true;
    if (location.pathname === "/admin" || location.hash === "#admin")
      void showAdmin();
    else admin.hidden = true;
  }
  window.addEventListener("hashchange", route);
  route();
  void loadCatalog();
}
