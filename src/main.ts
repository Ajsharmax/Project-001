import "./style.css";
import { tools, type ToolId } from "./catalog";

const app = document.querySelector<HTMLDivElement>("#app")!;
const brand = `<a class="brand" href="#home" aria-label="Project001 home"><span class="brand-mark">p<span>•</span></span>Project<span class="brand-number">001</span></a>`;
app.innerHTML = `
<a class="skip" href="#main">Skip to content</a>
<header><div class="nav-wrap">${brand}<nav aria-label="Main navigation"><a href="#home" class="nav-home">Home</a><a href="#applications" class="nav-apps">Applications</a><a href="#about">About</a></nav><a class="nav-cta" href="#applications">Explore tools <span aria-hidden="true">↗</span></a></div></header>
<main id="main">
<section class="hero" id="home"><div class="hero-copy"><div class="eyebrow"><span></span> SMALL TOOLS. BIG POSSIBILITIES.</div><h1>A little less busywork.<br>A lot more <em>possibility.</em></h1><p>Thoughtful tools for the things you do every day.<br>Work with PDFs, simplify your workflow, and get back<br class="desktop-break"> to what matters.</p><div class="hero-actions"><a class="button" href="#applications">Find your next tool <span aria-hidden="true">↗</span></a><span class="free-note">Free to use. Yours to explore.</span></div><div class="hero-trust"><span>✓ No sign-up</span><span>◇ Private by design</span><span>⌘ Runs in your browser</span></div></div>
<div class="hero-art" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="art-tag"><span class="green-dot"></span> A smoother workflow</div><div class="mini-file file-back"><span class="file-label">PDF</span><i></i><i></i><i></i></div><div class="mini-file file-front"><div class="file-top"><span class="file-label">PDF</span><span>✧</span></div><i></i><i></i><i></i><div class="file-chart"><b></b><b></b><b></b><b></b><b></b></div><div class="file-bottom">Less effort. More done. <span>✓</span></div></div><span class="art-tile tile-one">↗</span><span class="art-tile tile-two">⊞</span><div class="art-bottom"><span>✓</span> Made for your everyday.</div><span class="spark spark-one">✳</span><span class="spark spark-two">+</span></div></section>
<section class="applications section" id="applications" aria-labelledby="apps-title"><div class="section-top"><div><div class="eyebrow">YOUR EVERYDAY TOOLKIT</div><h2 id="apps-title">Good tools. Less friction.</h2><p>One place for the little things that move your day forward.</p></div><span class="tool-count">12 tools. Endless possibilities.</span></div><div class="tool-controls"><div class="filters" role="group" aria-label="Filter applications">${["All tools", "Organize", "Convert", "Optimize", "Security"].map((x, i) => `<button class="filter ${i === 0 ? "selected" : ""}" aria-pressed="${i === 0}" data-filter="${x}">${x}</button>`).join("")}</div><label class="search"><span aria-hidden="true">⌕</span><input type="search" id="search" placeholder="Find a tool…" aria-label="Search tools"><kbd>/</kbd></label></div><div class="cards" id="cards">${tools.map((t) => `<a class="tool-card" href="#tool/${t.id}" data-id="${t.id}" data-category="${t.category}"><span class="tool-icon ${t.color}" aria-hidden="true">${t.icon}</span><span class="card-arrow" aria-hidden="true">↗</span><h3>${t.name}</h3><p>${t.description}</p><span class="card-category">${t.category}</span></a>`).join("")}</div><p id="no-results" hidden>No tools match your search. Try “PDF” or another category.</p><div class="local-note"><span aria-hidden="true">◇</span><p><strong>Your files stay yours.</strong> Documents are processed on your device. No uploads. No accounts. No tracking.</p><a href="#privacy">Our privacy promise ↗</a></div></section>
<section class="about section" id="about"><div><div class="eyebrow">A SMALL PROJECT, WITH PURPOSE</div><h2>Built to be useful.<br>Designed to feel simple.</h2></div><div><p>Project001 is an independent collection of technology and productivity tools. A home for practical ideas that make everyday work a little easier.</p><p>No unnecessary steps. Just open a tool, get something done, and carry on.</p><a href="#applications" class="text-link">Make room for what matters ↗</a></div></section>
<section class="privacy section" id="privacy"><span class="tool-icon green" aria-hidden="true">◇</span><div><h2>Private by design.</h2><p>Your documents and passwords stay in this browser tab. Tool engines and the English OCR model load from this website. We don’t use analytics, upload documents, or store your files. Close the tab to release its memory; downloaded files remain on your device.</p><p>PDF outputs can change forms, signatures, accessibility tags, or metadata. Keep your originals and review the result before sharing.</p></div></section>
</main><footer><div>${brand}<p>A little less busywork. A little more possibility.</p></div><div><a href="#applications">Applications</a><a href="#privacy">Privacy</a><a href="https://github.com/Ajsharmax/Project-001" target="_blank" rel="noopener noreferrer">GitHub ↗</a></div><small>© ${new Date().getFullYear()} Project001. Made for everyday.</small></footer>
<dialog id="tool-dialog" aria-labelledby="tool-title"><div class="dialog-top"><span class="eyebrow">PROJECT001 / PDF TOOLKIT</span><button type="button" id="close-tool" aria-label="Close tool">✕</button></div><h2 id="tool-title"></h2><p id="tool-description"></p><form id="tool-form"><fieldset id="tool-fields"><label class="drop-zone" id="drop-zone"><span class="upload-icon" aria-hidden="true">↑</span><strong>Choose your PDF files</strong><span>or drop them here · up to 50 MB total</span><input type="file" id="files" accept="application/pdf,.pdf" required></label><ol id="file-list" aria-label="Selected files"></ol><div id="options"></div><button class="button run-button" type="submit">Process PDF <span aria-hidden="true">→</span></button></fieldset></form><p id="status" role="status" aria-live="polite"></p><a id="download" class="button download" hidden>Download result ↓</a><p class="dialog-privacy">◇ Processed locally. Your files never leave your device.</p></dialog>`;

const configuredDomain = import.meta.env.VITE_SITE_URL;
if (configuredDomain) {
  try {
    const url = new URL(configuredDomain);
    if (!["https:", "http:"].includes(url.protocol)) throw Error();
    const canonical = document.createElement("link");
    canonical.rel = "canonical";
    canonical.href = url.origin;
    document.head.append(canonical);
  } catch {
    console.warn("VITE_SITE_URL must be an HTTP(S) URL.");
  }
}
const dialog = document.querySelector<HTMLDialogElement>("#tool-dialog")!;
const form = document.querySelector<HTMLFormElement>("#tool-form")!;
const input = document.querySelector<HTMLInputElement>("#files")!;
const fields = document.querySelector<HTMLFieldSetElement>("#tool-fields")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const download = document.querySelector<HTMLAnchorElement>("#download")!;
let active: ToolId = "merge",
  files: File[] = [],
  objectUrl = "",
  busy = false;
let previousFocus: HTMLElement | null = null;
const clearResult = () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = "";
  download.hidden = true;
  download.removeAttribute("href");
  status.textContent = "";
};
function showFiles() {
  clearResult();
  const list = document.querySelector("#file-list")!;
  list.replaceChildren();
  files.forEach((file, index) => {
    const li = document.createElement("li");
    const text = document.createElement("span");
    text.textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    li.append(text);
    for (const [label, action] of [
      ["↑", "Move earlier"],
      ["×", "Remove"],
    ] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("aria-label", `${action}: ${file.name}`);
      button.disabled = label === "↑" && index === 0;
      button.onclick = () => {
        if (label === "×") files.splice(index, 1);
        else
          [files[index - 1], files[index]] = [files[index], files[index - 1]];
        showFiles();
      };
      li.append(button);
    }
    list.append(li);
  });
  input.required = files.length === 0;
}
const numberField = (name: string, label: string, value: number, min = 0) =>
  `<label>${label}<input type="number" name="${name}" value="${value}" min="${min}" step="1" required></label>`;
function route() {
  const id = location.hash.replace("#tool/", "");
  const tool = tools.find((t) => t.id === id);
  document
    .querySelector(".nav-home")
    ?.classList.toggle("active", !location.hash || location.hash === "#home");
  document
    .querySelector(".nav-apps")
    ?.classList.toggle("active", location.hash === "#applications" || !!tool);
  if (!tool) {
    if (dialog.open && !busy) dialog.close();
    return;
  }
  if (busy) return;
  active = tool.id;
  files = [];
  input.value = "";
  input.multiple = active === "merge";
  showFiles();
  document.querySelector("#tool-title")!.textContent = tool.name;
  document.querySelector("#tool-description")!.textContent = tool.note;
  const options = document.querySelector("#options")!;
  options.innerHTML =
    active === "split"
      ? '<label>Pages to extract<input name="pages" value="1" placeholder="1, 3-5" required></label>'
      : active === "rotate"
        ? '<label>Clockwise rotation<select name="angle"><option value="90">90°</option><option value="180">180°</option><option value="270">270°</option></select></label>'
        : active === "crop"
          ? numberField("margin", "Margin on each side (PDF points)", 18)
          : ["protect", "unlock"].includes(active)
            ? `<label>${active === "protect" ? "New password (at least 8 characters)" : "Existing password"}<input type="password" name="password" autocomplete="off" ${active === "protect" ? 'minlength="8" required' : ""}></label>`
            : active === "redact"
              ? `<p>Rectangle in PDF points, measured from the top-left. The same area is NOT applied to other pages.</p><div class="number-grid">${numberField("page", "Page", 1, 1)}${numberField("x", "Left", 0)}${numberField("y", "Top", 0)}${numberField("width", "Width", 150, 1)}${numberField("height", "Height", 50, 1)}</div><label class="confirm"><input type="checkbox" required> I will review the flattened output before sharing.</label>`
              : "";
  if (!dialog.open) {
    previousFocus = document.activeElement as HTMLElement;
    dialog.showModal();
  }
}
const close = () => {
  if (!busy) {
    dialog.close();
    location.hash = "applications";
    previousFocus?.focus();
  }
};
document.querySelector("#close-tool")!.addEventListener("click", close);
dialog.addEventListener("cancel", (e) => {
  e.preventDefault();
  close();
});
window.addEventListener("hashchange", route);
route();
input.addEventListener("change", () => {
  const selected = Array.from(input.files ?? []);
  files = active === "merge" ? [...files, ...selected] : selected.slice(0, 1);
  showFiles();
});
const drop = document.querySelector<HTMLElement>("#drop-zone")!;
drop.addEventListener("dragover", (e) => {
  e.preventDefault();
});
drop.addEventListener("drop", (e) => {
  e.preventDefault();
  if (busy) return;
  const selected = Array.from(e.dataTransfer?.files ?? []);
  files = active === "merge" ? [...files, ...selected] : selected.slice(0, 1);
  showFiles();
});
form.addEventListener("input", () => {
  if (!busy) clearResult();
});
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  clearResult();
  const data = new FormData(form);
  const value = (key: string, fallback = 0) =>
    Number(data.get(key) ?? fallback);
  busy = true;
  fields.disabled = true;
  document.querySelector<HTMLButtonElement>("#close-tool")!.disabled = true;
  status.textContent = "Loading local tools…";
  try {
    const { processPdf } = await import("./pdf");
    const result = await processPdf(
      active,
      files,
      {
        pages: String(data.get("pages") ?? ""),
        angle: value("angle", 90),
        margin: value("margin"),
        password: String(data.get("password") ?? ""),
        page: value("page", 1),
        x: value("x"),
        y: value("y"),
        width: value("width"),
        height: value("height"),
      },
      (s) => {
        status.textContent = s;
      },
    );
    objectUrl = URL.createObjectURL(result.blob);
    download.href = objectUrl;
    download.download = result.name;
    download.hidden = false;
    status.textContent =
      result.message ??
      `Ready. Your download is ${(result.blob.size / 1024).toFixed(1)} KB. Review the output before sharing.`;
    download.focus();
  } catch (error) {
    status.textContent =
      error instanceof Error
        ? error.message
        : "Something went wrong. Try another PDF.";
  } finally {
    busy = false;
    fields.disabled = false;
    document.querySelector<HTMLButtonElement>("#close-tool")!.disabled = false;
    const password = form.querySelector<HTMLInputElement>("[name=password]");
    if (password) password.value = "";
    if (!location.hash.startsWith("#tool/")) close();
  }
});
let category = "All tools";
const search = document.querySelector<HTMLInputElement>("#search")!;
function filter() {
  let count = 0;
  document.querySelectorAll<HTMLElement>(".tool-card").forEach((card) => {
    const show =
      (category === "All tools" || card.dataset.category === category) &&
      (card.textContent ?? "")
        .toLowerCase()
        .includes(search.value.trim().toLowerCase());
    card.hidden = !show;
    if (show) count++;
  });
  document.querySelector<HTMLElement>("#no-results")!.hidden = count !== 0;
}
document.querySelectorAll<HTMLButtonElement>(".filter").forEach(
  (button) =>
    (button.onclick = () => {
      category = button.dataset.filter!;
      document.querySelectorAll(".filter").forEach((b) => {
        b.classList.toggle("selected", b === button);
        b.setAttribute("aria-pressed", String(b === button));
      });
      filter();
    }),
);
search.addEventListener("input", filter);
document.addEventListener("keydown", (e) => {
  if (
    e.key === "/" &&
    !dialog.open &&
    !["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName)
  ) {
    e.preventDefault();
    search.focus();
  }
});
window.addEventListener("pagehide", () => {
  if (objectUrl) URL.revokeObjectURL(objectUrl);
});
