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
function driveImageUrls(rawUrl) {
  rawUrl = rawUrl.trim().replace(/^"|"$/g, "");
  try {
    const u = new URL(rawUrl);
    const id = u.searchParams.get("id") 
             || (rawUrl.match(/\/file\/d\/([^/]+)/) || [])[1];
    if (!id) return { primary: rawUrl };

    return {
      primary: `https://drive.google.com/thumbnail?id=${id}`, // 優先用縮圖
      fallback: `https://drive.google.com/uc?export=view&id=${id}` // 備用
    };
  } catch {
    return { primary: rawUrl };
  }
}

function cardHtml(item) {
  const { primary, fallback } = driveImageUrls(item.image);
  return `<div class="card"><div class="card__img">
    <img src="${primary}" alt="${item.name}"
         onerror="if('${fallback}') this.src='${fallback}'">
  </div></div>`;
}



// ====== 渲染單頁（4張 slot） ======
function cardHtml(item) {
  return `<div class="card"><div class="card__img">
    <img src="${item.image}" alt="${item.name}"
         onerror="this.src='${CONFIG.FALLBACK_IMG}'">
  </div></div>`;
}
function render() {
  const totalPages = Math.max(1, Math.ceil(items.length / 4));
  page = Math.min(Math.max(1, page), totalPages);
  const start = (page - 1) * 4;
  const slice = items.slice(start, start + 4);

  bookEl.innerHTML = `
    <div class="album__book-bg">
      <div class="slot slot1">${slice[0] ? cardHtml(slice[0]) : ""}</div>
      <div class="slot slot2">${slice[1] ? cardHtml(slice[1]) : ""}</div>
      <div class="slot slot3">${slice[2] ? cardHtml(slice[2]) : ""}</div>
      <div class="slot slot4">${slice[3] ? cardHtml(slice[3]) : ""}</div>
    </div>
  `;

  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  pageInfo.textContent = `Page ${page} / ${totalPages}`;

  ensureAspectRatio();
}

// ====== 自動套背景比例 ======
function ensureAspectRatio() {
  const bg = bookEl.dataset.bg;
  if (!bg) return;
  const img = new Image();
  img.onload = () => {
    const ratio = `${img.naturalWidth} / ${img.naturalHeight}`;
    document.querySelectorAll(".album__book-bg").forEach((el) => {
      el.style.aspectRatio = ratio;
      el.style.backgroundImage = `url("${bg}")`;
    });
  };
  img.src = bg;
}

// ====== 校正模式切換 ======
function setupDebugToggle() {
  const btn = document.getElementById("toggleDebugBtn");
  const toggle = () => {
    document
      .querySelectorAll(".album__book-bg")
      .forEach((el) => el.classList.toggle("debug"));
  };
  btn.addEventListener("click", toggle);
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
