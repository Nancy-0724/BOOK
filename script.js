// ====== 設定 ======
const CONFIG = {
  CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0uiIFX8FEhOYhGpg3xKPrd7ITtYWFaWPKpQCURV-sx5m90MeNGSDT2scS70a3EQeIpRLu-t9hZK6i/pub?gid=0&single=true&output=csv",
  NAME_INDEX: 1, // B欄
  IMAGE_INDEX: 6, // G欄
  FALLBACK_IMG:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450">
        <rect width="100%" height="100%" fill="#f2f2f2"/>
        <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle"
              fill="#999" font-size="24">No Image</text>
      </svg>`
    )
};

const bookEl = document.getElementById("book");
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const reloadBtn = document.getElementById("reloadBtn");
const pageInfo = document.getElementById("pageInfo");

let items = [];
let page = 1;

// ====== CSV 讀取 ======
async function fetchCSV() {
  const res = await fetch(CONFIG.CSV_URL + "&ts=" + Date.now());
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.split(",").map((x) => x.replace(/^"|"$/g, "")));
  const data = [];
  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    const name = (cols[CONFIG.NAME_INDEX] || "").trim();
    const image = toDirectDriveUrl((cols[CONFIG.IMAGE_INDEX] || "").trim());
    if (name || image) data.push({ name, image });
  }
  return data;
}

// ====== URL 轉換 ======
function toDirectDriveUrl(url) {
  if (!url) return "";
  url = url.trim().replace(/^"|"$/g, "");
  try {
    const u = new URL(url);
    const id =
      u.searchParams.get("id") || (url.match(/\/file\/d\/([^/]+)/) || [])[1];
    if (!id) return url;
    return `https://drive.google.com/thumbnail?id=${id}`;
  } catch {
    return url;
  }
}

function driveImageUrls(rawUrl) {
  rawUrl = rawUrl.trim().replace(/^"|"$/g, "");
  try {
    const u = new URL(rawUrl);
    const id =
      u.searchParams.get("id") || (rawUrl.match(/\/file\/d\/([^/]+)/) || [])[1];
    if (!id) return { primary: rawUrl };
    return {
      primary: `https://drive.google.com/thumbnail?id=${id}`,
      fallback: `https://drive.google.com/uc?export=view&id=${id}`
    };
  } catch {
    return { primary: rawUrl };
  }
}

// ====== 卡片 HTML（含名稱標籤） ======
function cardHtml(item) {
  const { primary, fallback } = driveImageUrls(item.image || "");
  const label = item.name
    ? `<div class="card__label" title="${item.name}">${item.name}</div>`
    : "";
  return `<div class="card">
            ${label}
            <div class="card__img">
              <img src="${primary}" alt="${item.name}"
                   onerror="this.onerror=null;this.src='${
                     fallback || CONFIG.FALLBACK_IMG
                   }'">
            </div>
          </div>`;
}

// ====== 計算總面數：第1面=4張，其後每面=8張 ======
function totalPagesFor(count) {
  if (count <= 4) return 1;
  return 1 + Math.ceil((count - 4) / 8);
}

// ====== 讀取背景設定 ======
function getBackgrounds() {
  // 支援舊屬性 data-bg（若只給一張）
  const single = bookEl.dataset.bgSingle || bookEl.dataset.bg || "";
  const left = bookEl.dataset.bgLeft || single;
  const right = bookEl.dataset.bgRight || single;
  return { single, left, right };
}

// ====== 渲染 ======
function render() {
  const totalPages = totalPagesFor(items.length);
  page = Math.min(Math.max(1, page), totalPages);
  const { single, left, right } = getBackgrounds();

  if (page === 1) {
    // 第1面：只顯示4張
    const slice = items.slice(0, 4);
    bookEl.innerHTML = `
      <div class="album__book-bg" data-side="single">
        <div class="slot slot1">${slice[0] ? cardHtml(slice[0]) : ""}</div>
        <div class="slot slot2">${slice[1] ? cardHtml(slice[1]) : ""}</div>
        <div class="slot slot3">${slice[2] ? cardHtml(slice[2]) : ""}</div>
        <div class="slot slot4">${slice[3] ? cardHtml(slice[3]) : ""}</div>
      </div>
    `;
  } else {
    // 之後每一面：顯示8張（左右各4張）
    const start = 4 + (page - 2) * 8;
    const slice = items.slice(start, start + 8);
    const leftCards = slice.slice(0, 4);
    const rightCards = slice.slice(4, 8);

    bookEl.innerHTML = `
      <div class="album__spread">
        <div class="album__book-bg" data-side="left">
          <div class="slot slot1">${
            leftCards[0] ? cardHtml(leftCards[0]) : ""
          }</div>
          <div class="slot slot2">${
            leftCards[1] ? cardHtml(leftCards[1]) : ""
          }</div>
          <div class="slot slot3">${
            leftCards[2] ? cardHtml(leftCards[2]) : ""
          }</div>
          <div class="slot slot4">${
            leftCards[3] ? cardHtml(leftCards[3]) : ""
          }</div>
        </div>
        <div class="album__book-bg" data-side="right">
          <div class="slot slot1">${
            rightCards[0] ? cardHtml(rightCards[0]) : ""
          }</div>
          <div class="slot slot2">${
            rightCards[1] ? cardHtml(rightCards[1]) : ""
          }</div>
          <div class="slot slot3">${
            rightCards[2] ? cardHtml(rightCards[2]) : ""
          }</div>
          <div class="slot slot4">${
            rightCards[3] ? cardHtml(rightCards[3]) : ""
          }</div>
        </div>
      </div>
    `;
  }

  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  pageInfo.textContent = `PAGE ${page} / ${totalPages}`;

  ensureAspectRatio();
  applyBackgrounds();
}

// ====== 自動套背景比例（以 single 或 left 的比例為準） ======
function ensureAspectRatio() {
  const { single, left } = getBackgrounds();
  const probe = single || left;
  if (!probe) return;
  const img = new Image();
  img.onload = () => {
    const ratio = `${img.naturalWidth} / ${img.naturalHeight}`;
    document.querySelectorAll(".album__book-bg").forEach((el) => {
      el.style.aspectRatio = ratio;
    });
  };
  img.src = probe;
}

// ====== 套用左右背景 ======
function applyBackgrounds() {
  const { single, left, right } = getBackgrounds();
  document.querySelectorAll(".album__book-bg").forEach((el) => {
    const side = el.getAttribute("data-side");
    if (side === "left")
      el.style.backgroundImage = left ? `url("${left}")` : "";
    else if (side === "right")
      el.style.backgroundImage = right ? `url("${right}")` : "";
    else el.style.backgroundImage = single ? `url("${single}")` : "";
  });
}

// ====== 校正模式切換 ======
function setupDebugToggle() {
  const btn = document.getElementById("toggleDebugBtn");
  const toggle = () => {
    document
      .querySelectorAll(".album__book-bg")
      .forEach((el) => el.classList.toggle("debug"));
  };
  if (btn) btn.addEventListener("click", toggle);
  document.addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() === "d") toggle();
  });
}

// ====== 事件 ======
prevBtn.onclick = () => {
  page--;
  render();
};
nextBtn.onclick = () => {
  page++;
  render();
};
reloadBtn.onclick = () => loadData();

// ====== 啟動 ======
async function loadData() {
  bookEl.innerHTML = "載入中...";
  items = await fetchCSV();
  page = 1;
  render();
}
loadData();
setupDebugToggle();