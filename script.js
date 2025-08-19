// ====== 可調整設定 ======
const CONFIG = {
  CSV_URL:
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vQ0uiIFX8FEhOYhGpg3xKPrd7ITtYWFaWPKpQCURV-sx5m90MeNGSDT2scS70a3EQeIpRLu-t9hZK6i/pub?gid=0&single=true&output=csv", // 你的 Sheet 發佈成 CSV 的網址
  ITEMS_PER_PAGE: 4,
  AUTO_REFRESH_MS: 0,

  // 方式一：用欄名（建議，需確保首列為表頭且拼字一致）
  NAME_FIELD: "title", // 讀 B 欄的欄名
  IMAGE_FIELD: "imageUrl", // 讀 G 欄的欄名

  // 方式二：用欄位索引（0-based），若表頭被刪掉或名稱不一致時可啟用
  FALLBACK_BY_INDEX: true, // true=若找不到欄名就用索引
  NAME_INDEX: 1, // B 欄 → index=1
  IMAGE_INDEX: 6, // G 欄 → index=6

  // 圖片失敗時的預設圖
  FALLBACK_IMG:
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450">
      <rect width="100%" height="100%" fill="#f2f2f2"/>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#999" font-size="24">No Image</text>
    </svg>`
    )
};

// ====== Drive 連結處理：支援 thumbnail?id= 與 file/d/.../view 兩種常見格式 ======
function toDirectDriveUrl(url) {
  if (!url) return "";
  try {
    // 1) https://drive.google.com/thumbnail?id=FILE_ID
    const thumbId = new URL(url).searchParams.get("id");
    if (thumbId) return `https://drive.google.com/uc?export=view&id=${thumbId}`;

    // 2) https://drive.google.com/file/d/FILE_ID/view?usp=sharing
    const m = url.match(/\/file\/d\/([^/]+)/);
    if (m && m[1]) return `https://drive.google.com/uc?export=view&id=${m[1]}`;

    return url; // 其他直接回傳
  } catch {
    return url;
  }
}

// ====== 取 CSV 並解析（只取 B 欄 title、G 欄 imageUrl） ======
async function fetchCSV() {
  const csvUrl =
    CONFIG.CSV_URL +
    (CONFIG.CSV_URL.includes("?") ? "&" : "?") +
    "ts=" +
    Date.now();
  const res = await fetch(csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error("取資料失敗：" + res.status);
  const text = await res.text();
  return parseCSV(text);
}

function parseCSV(text) {
  // 簡單切行/切欄；若內容含逗號引號等，建議後續換更完整的 CSV parser
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((x) => x.replace(/^"|"$/g, "")));

  // 嘗試讀表頭
  const header = rows[0]?.map((h) => (h || "").trim().toLowerCase()) || [];
  let nameIdx = header.indexOf((CONFIG.NAME_FIELD || "").toLowerCase());
  let imgIdx = header.indexOf((CONFIG.IMAGE_FIELD || "").toLowerCase());

  // 若找不到欄名且允許索引後援→用索引(B=1, G=6)
  const startRow = 1;
  if (nameIdx < 0 || imgIdx < 0) {
    if (CONFIG.FALLBACK_BY_INDEX) {
      nameIdx = CONFIG.NAME_INDEX;
      imgIdx = CONFIG.IMAGE_INDEX;
    } else {
      throw new Error("找不到指定欄名（請確認表頭有 title / imageUrl）");
    }
  }

  // 轉成清單
  const data = [];
  for (let r = startRow; r < rows.length; r++) {
    const cols = rows[r];
    const name = (cols[nameIdx] || "").trim();
    const image = toDirectDriveUrl((cols[imgIdx] || "").trim());
    if (name || image) data.push({ name, image });
  }
  return data;
}

// ====== 以下 render / 分頁 / 事件 維持不變（你的舊程式可直接沿用） ======

// ====== 渲染 ======
function render() {
  const total = items.length;
  const per = CONFIG.ITEMS_PER_PAGE;
  const totalPages = Math.max(1, Math.ceil(total / per));
  page = Math.min(Math.max(1, page), totalPages);

  const start = (page - 1) * per;
  const slice = items.slice(start, start + per);

  gridEl.innerHTML = slice
    .map(
      (item) => `
    <article class="card">
      <div class="card__img">
        <img src="${item.image}" alt="${escapeHtml(
        item.name
      )}" onerror="this.src='${CONFIG.FALLBACK_IMG}'" loading="lazy">
      </div>
      <div class="card__meta">
        <h3 class="card__title" title="${escapeHtml(item.name)}">${escapeHtml(
        item.name
      )}</h3>
      </div>
    </article>
  `
    )
    .join("");

  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  pageInfo.textContent = `Page ${page} / ${totalPages}`;
}

// ====== 事件 ======
prevBtn.addEventListener("click", () => {
  page--;
  render();
});
nextBtn.addEventListener("click", () => {
  page++;
  render();
});
reloadBtn.addEventListener("click", () => {
  loadData();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") {
    if (!prevBtn.disabled) {
      page--;
      render();
    }
  }
  if (e.key === "ArrowRight") {
    if (!nextBtn.disabled) {
      page++;
      render();
    }
  }
});

// ====== 安全字串 ======
function escapeHtml(s = "") {
  return s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[
        c
      ])
  );
}

// ====== 載入流程 ======
async function loadData() {
  gridEl.innerHTML = '<p style="padding:24px">載入中…</p>';
  try {
    items = await fetchCSV();
    page = 1;
    render();
  } catch (err) {
    gridEl.innerHTML = `<p style="color:#b00020;padding:24px">載入失敗：${escapeHtml(
      String(err.message || err)
    )}</p>`;
  }
}

// ====== 自動刷新（選用） ======
function scheduleAutoRefresh() {
  if (CONFIG.AUTO_REFRESH_MS > 0) {
    setInterval(loadData, CONFIG.AUTO_REFRESH_MS);
  }
}

// 啟動
loadData();
scheduleAutoRefresh();