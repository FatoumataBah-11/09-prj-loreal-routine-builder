/* =======================================================
   L’Oréal Routine Builder — script.js
======================================================= */

/* ---------- DOM Refs ---------- */
const productsContainer = document.getElementById("productsContainer");
const categoryFilter = document.getElementById("categoryFilter");
const searchInput = document.getElementById("searchInput");
const selectedProductsList = document.getElementById("selectedProductsList");
const clearSelectionsBtn = document.getElementById("clearSelections");
const generateBtn = document.getElementById("generateRoutine");
const chatWindow = document.getElementById("chatWindow");
const chatForm = document.getElementById("chatForm");
const userInput = document.getElementById("userInput");
const rtlToggle = document.getElementById("rtlToggle");

/* ---------- Config ---------- */
const WORKER_URL = "https://wanderbot-worker.fatoumata6871.workers.dev/";

const SYSTEM_PROMPT = `
You are L’Oréal’s Product-Aware Routine Builder Assistant.
Goals:
1) Build a routine ONLY from the provided selected products JSON (no inventing new products).
2) Ask clarifying questions if the selection is missing essentials.
3) Explain AM/PM steps with how-to and ingredients.
4) Respect skin or hair concerns if user mentions them.
5) Include 2–4 reputable links when discussing ingredients or general skincare concepts.
6) Tone: clean, concise, professional, friendly.
`;

/* ---------- App State ---------- */
let allProducts = [];
let filteredProducts = [];
let selectedIds = new Set(loadSelectedIds());
let chatHistory = [];

/* ---------- Boot ---------- */
init();

async function init() {
  const savedDir = localStorage.getItem("dir");
  if (savedDir === "rtl") {
    document.documentElement.setAttribute("dir", "rtl");
  }

  allProducts = await loadProducts();
  renderProducts(allProducts);
  renderSelectedChips();

  categoryFilter.addEventListener("change", handleFilterAndSearch);
  searchInput.addEventListener("input", debounce(handleFilterAndSearch, 200));
  clearSelectionsBtn.addEventListener("click", clearSelections);
  generateBtn.addEventListener("click", generateRoutine);
  chatForm.addEventListener("submit", handleChatSubmit);
  rtlToggle.addEventListener("click", toggleRTL);

  if (!categoryFilter.value && !searchInput.value.trim()) {
    productsContainer.innerHTML = `<div class="placeholder-message">Choose a category or search</div>`;
  }
}

/* ---------- Data ---------- */
async function loadProducts() {
  const res = await fetch("products.json", { cache: "no-store" });
  const data = await res.json();
  return data.products || [];
}

/* ---------- Filters ---------- */
function handleFilterAndSearch() {
  const cat = categoryFilter.value.toLowerCase();
  const q = searchInput.value.toLowerCase().trim();

  filteredProducts = allProducts.filter((p) => {
    const matchesCat = !cat || p.category.toLowerCase() === cat;
    const hay =
      `${p.name} ${p.brand} ${p.category} ${p.description}`.toLowerCase();
    const matchesQ = !q || hay.includes(q);
    return matchesCat && matchesQ;
  });

  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `<div class="placeholder-message">No products match your filters</div>`;
  } else {
    renderProducts(filteredProducts);
  }
}

/* ---------- Render Grid ---------- */
function renderProducts(list) {
  productsContainer.innerHTML = "";
  const frag = document.createDocumentFragment();

  list.forEach((p) => {
    const card = document.createElement("div");
    card.className = "product-card";
    if (selectedIds.has(p.id)) card.classList.add("selected");
    card.dataset.id = String(p.id);

    card.innerHTML = `
      <span class="select-check"><i class="fa-solid fa-check"></i></span>
      <img src="${p.image}" alt="${escapeHtml(p.name)}" loading="lazy" />

      <div class="product-info">
        <h3>${escapeHtml(p.name)}</h3>
        <div class="brand">${escapeHtml(p.brand)}</div>

        <div class="product-meta">
          <span class="badge badge--cat">${escapeHtml(p.category)}</span>
          <span class="badge badge--brand">${escapeHtml(p.brand)}</span>
        </div>

        <button class="desc-toggle" type="button" aria-expanded="false">
          Description
        </button>
      </div>

      <div class="desc-overlay" role="region">
        <h4>About this product</h4>
        <p>${escapeHtml(p.description)}</p>
      </div>
    `;

    card.addEventListener("click", (e) => {
      if (e.target.classList.contains("desc-toggle")) {
        e.stopPropagation();
        const expanded = e.target.getAttribute("aria-expanded") === "true";
        e.target.setAttribute("aria-expanded", String(!expanded));
        card.classList.toggle("open");
        return;
      }

      toggleSelect(p.id, card);
    });

    frag.appendChild(card);
  });

  productsContainer.appendChild(frag);
}

/* ---------- Selection ---------- */
function toggleSelect(id, cardEl) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
    cardEl.classList.remove("selected");
  } else {
    selectedIds.add(id);
    cardEl.classList.add("selected");
  }
  persistSelectedIds();
  renderSelectedChips();
}

function renderSelectedChips() {
  selectedProductsList.innerHTML = "";

  if (selectedIds.size === 0) {
    selectedProductsList.innerHTML = `<div class="placeholder-message">No products selected yet</div>`;
    return;
  }

  const frag = document.createDocumentFragment();
  const selected = allProducts.filter((p) => selectedIds.has(p.id));

  selected.forEach((p) => {
    const chip = document.createElement("div");
    chip.className = "chip";
    chip.innerHTML = `
      <span><strong>${escapeHtml(p.name)}</strong> <small>by ${escapeHtml(
      p.brand
    )}</small></span>
      <button class="chip-remove" aria-label="Remove ${escapeHtml(
        p.name
      )}">&times;</button>
    `;

    chip.querySelector(".chip-remove").addEventListener("click", () => {
      selectedIds.delete(p.id);
      persistSelectedIds();

      const card = document.querySelector(`.product-card[data-id="${p.id}"]`);
      if (card) card.classList.remove("selected");

      renderSelectedChips();
    });

    frag.appendChild(chip);
  });

  selectedProductsList.appendChild(frag);
}

function clearSelections() {
  selectedIds.clear();
  persistSelectedIds();

  document.querySelectorAll(".product-card.selected").forEach((el) => {
    el.classList.remove("selected");
  });

  renderSelectedChips();
}

function persistSelectedIds() {
  localStorage.setItem("selectedProductIds", JSON.stringify([...selectedIds]));
}
function loadSelectedIds() {
  try {
    return JSON.parse(localStorage.getItem("selectedProductIds")) || [];
  } catch {
    return [];
  }
}

/* ---------- RTL Toggle ---------- */
function toggleRTL() {
  const next =
    document.documentElement.getAttribute("dir") === "rtl" ? "ltr" : "rtl";
  document.documentElement.setAttribute("dir", next);
  localStorage.setItem("dir", next);
}

/* ---------- Chat UI ---------- */
function appendMsg(role, html) {
  const div = document.createElement("div");
  div.className = "msg " + (role === "user" ? "user" : "bot");
  div.innerHTML = html;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

/* ---------- Routine Generation ---------- */
async function generateRoutine() {
  if (selectedIds.size === 0) {
    appendMsg("bot", "Please select at least one product first.");
    return;
  }

  const selected = allProducts.filter((p) => selectedIds.has(p.id));

  appendMsg("bot", "Building your routine… ✨");

  chatHistory = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content:
        "Create a full AM/PM routine using ONLY these products:\n\n" +
        JSON.stringify(selected, null, 2),
    },
  ];

  try {
    const assistant = await callWorker(chatHistory);
    appendMsg("bot", linkify(escapeHtml(assistant)));
    chatHistory.push({ role: "assistant", content: assistant });
  } catch (err) {
    appendMsg("bot", "Something went wrong. Try again.");
  }
}

/* ---------- Follow-up Chat ---------- */
async function handleChatSubmit(e) {
  e.preventDefault();
  const text = userInput.value.trim();
  if (!text) return;

  appendMsg("user", escapeHtml(text));
  userInput.value = "";

  if (chatHistory.length === 0) {
    chatHistory.push({ role: "system", content: SYSTEM_PROMPT });
  }

  const selected = allProducts.filter((p) => selectedIds.has(p.id));
  const context = selected.length
    ? "\nSelected Products:\n" + JSON.stringify(selected, null, 2)
    : "";

  chatHistory.push({
    role: "user",
    content:
      `Follow-up question: ${text}\nInclude reputable links.\n` + context,
  });

  appendMsg("bot", "Thinking…");

  try {
    const assistant = await callWorker(chatHistory);

    const last = chatWindow.lastElementChild;
    if (last && last.innerText === "Thinking…") last.remove();

    appendMsg("bot", linkify(escapeHtml(assistant)));
    chatHistory.push({ role: "assistant", content: assistant });
  } catch {
    appendMsg("bot", "Try again later.");
  }
}

/* ---------- Worker Call ---------- */
async function callWorker(history) {
  const res = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: history,
      include_links: true,
      project: "loreal-routine-builder",
    }),
  });

  const data = await res.json();
  return (
    data?.choices?.[0]?.message?.content || data?.reply || data?.content || ""
  );
}

/* ---------- Utils ---------- */
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function linkify(text) {
  const urlRegex = /((https?:\/\/)[^\s)]+)/g;
  return text.replace(urlRegex, `<a href="$1" target="_blank">$1</a>`);
}
