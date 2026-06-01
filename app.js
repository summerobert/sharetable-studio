const monthNames = [
  "Január",
  "Február",
  "Marec",
  "Apríl",
  "Máj",
  "Jún",
  "Júl",
  "August",
  "September",
  "Október",
  "November",
  "December",
];

const platformInfo = {
  Instagram: {
    className: "instagram",
    hint: "vizuálny post, carousel, reel alebo story",
  },
  TikTok: {
    className: "tiktok",
    hint: "krátke video s hookom, trend alebo zákulisie",
  },
  LinkedIn: {
    className: "linkedin",
    hint: "odborný post, príbeh z praxe alebo výsledok",
  },
  Facebook: {
    className: "facebook",
    hint: "komunitný post, album, udalosť alebo otázka",
  },
};

const templates = {
  Instagram: {
    title: "Ukážka vizuálneho postu",
    format: "Carousel",
    caption: "Sem môže ísť carousel, pred/po ukážka, produktový detail alebo krátky reel caption.",
  },
  TikTok: {
    title: "Ukážka krátkeho videa",
    format: "Reel / short video",
    caption: "Sem môže ísť hook na prvé 2 sekundy, krátky návod, trend alebo zákulisné video.",
  },
  LinkedIn: {
    title: "Ukážka odborného postu",
    format: "Text post",
    caption: "Sem môže ísť know-how, skúsenosť z projektu, výsledok, názor alebo mini case study.",
  },
  Facebook: {
    title: "Ukážka komunitného postu",
    format: "Photo post",
    caption: "Sem môže ísť album, otázka pre komunitu, lokálny príbeh alebo pozvánka na udalosť.",
  },
};

const today = new Date();
const todayIso = isoFromDate(today);
const planningStart = new Date(2026, 5, 1);
const planningStartIso = isoFromDate(planningStart);
let currentMonth = new Date(planningStart.getFullYear(), planningStart.getMonth(), 1);
let activeFilter = "All";
let selectedId = null;
let selectedDateIso = planningStartIso;

const form = document.getElementById("post-form");
const dateInput = form.elements.date;
dateInput.value = planningStartIso;
let stagedMediaItems = [];
const cloudConfig = window.SHARETABLE_SUPABASE || {};
let supabaseClient = null;
let cloudSession = null;
let cloudWorkspace = loadCloudWorkspaceMeta();
let cloudSaveTimer = null;
let isApplyingCloudPayload = false;

let posts = loadPosts();
if (!posts.length) {
  posts = seedTemplatePosts();
  savePosts();
}

document.getElementById("prev-month").addEventListener("click", () => changeMonth(-1));
document.getElementById("next-month").addEventListener("click", () => changeMonth(1));
document.getElementById("export-xls").addEventListener("click", exportXls);
document.getElementById("open-share").addEventListener("click", openShareDialog);
document.getElementById("open-cloud").addEventListener("click", openCloudDialog);
document.getElementById("copy-code").addEventListener("click", copyShareCode);
document.getElementById("load-code").addEventListener("click", importShareCode);
document.getElementById("cloud-login").addEventListener("click", sendMagicLink);
document.getElementById("cloud-logout").addEventListener("click", signOutCloud);
document.getElementById("cloud-create").addEventListener("click", createCloudWorkspace);
document.getElementById("cloud-join").addEventListener("click", joinCloudWorkspace);
document.getElementById("cloud-save").addEventListener("click", saveCloudWorkspace);
document.getElementById("cloud-load").addEventListener("click", loadCloudWorkspace);
document.getElementById("copy-sql").addEventListener("click", copySupabaseSql);
document.getElementById("copy-config").addEventListener("click", copySupabaseConfig);
document.getElementById("cancel-edit").addEventListener("click", resetComposer);
form.elements.media.addEventListener("change", async () => {
  const files = Array.from(form.elements.media.files || []);
  const loadedItems = await Promise.all(files.map(fileToStoredMediaItem));
  stagedMediaItems.push(...loadedItems);
  form.elements.media.value = "";
  renderMediaList();
  setFormStatus(form.elements.editingId.value ? "Fotky sa ukladajú..." : "Fotky sú pridané do náhľadu.");
  saveMediaToEditingPost();
  renderComposerPreviews();
  setFormStatus(
    form.elements.editingId.value
      ? "Fotky sú uložené a zobrazené v náhľade."
      : "Fotky sú pridané do náhľadu. Príspevok uložíš tlačidlom Uložiť do mesiaca.",
  );
});
["platform", "format", "date", "time", "title", "caption"].forEach((name) => {
  form.elements[name].addEventListener("input", renderComposerPreviews);
});
document.getElementById("clear-demo").addEventListener("click", () => {
  posts = [];
  selectedId = null;
  resetComposer();
  savePosts();
  render();
});

document.querySelectorAll("[data-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    setActiveFilter(button.dataset.filter);
    render();
  });
});

document.querySelectorAll("[data-template]").forEach((button) => {
  button.addEventListener("click", () => {
    const platform = button.dataset.template;
    const template = templates[platform];
    form.elements.platform.value = platform;
    form.elements.format.value = template.format;
    form.elements.title.value = template.title;
    form.elements.caption.value = template.caption;
    renderComposerPreviews();
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  const editingId = data.get("editingId");
  const existing = editingId ? posts.find((post) => post.id === editingId) : null;
  const mediaItems = [...stagedMediaItems];
  const firstMedia = mediaItems[0] || null;
  const post = {
    id: existing ? existing.id : crypto.randomUUID(),
    title: data.get("title").trim(),
    platform: data.get("platform"),
    format: data.get("format"),
    date: data.get("date"),
    time: data.get("time") || "09:00",
    caption: data.get("caption").trim(),
    media: firstMedia?.url || existing?.media || null,
    mediaType: firstMedia?.type || existing?.mediaType || "",
    mediaName: firstMedia?.name || existing?.mediaName || "",
    mediaItems: mediaItems.length ? mediaItems : existing?.mediaItems || [],
    status: nextStatusAfterEdit(existing),
    comment: existing?.comment || "",
    comments: existing?.comments || [],
  };
  if (existing) {
    posts = posts.map((item) => (item.id === existing.id ? post : item));
  } else {
    posts.push(post);
  }
  selectedId = post.id;
  currentMonth = new Date(`${post.date}T00:00:00`);
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  setActiveFilter("All");
  savePosts();
  resetComposer();
  setFormStatus(
    existing
      ? statusMessageAfterEdit(post.status)
      : mediaItems.length
      ? "Príspevok je pridaný. Fotky sú uložené v prehliadači a ostanú po obnovení."
      : "Príspevok je pridaný.",
  );
  render();
});

form.addEventListener(
  "invalid",
  () => {
    setFormStatus("Vyplň názov a dátum príspevku.");
  },
  true,
);

function changeMonth(offset) {
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1);
  dateInput.value = getDefaultDateForCurrentMonth();
  render();
}

function render() {
  document.getElementById("month-label").textContent =
    `${monthNames[currentMonth.getMonth()]} ${currentMonth.getFullYear()}`;
  renderCalendar();
  renderSelected();
}

function renderCalendar() {
  const grid = document.getElementById("calendar-grid");
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const start = new Date(year, month, 1 - offset);

  grid.innerHTML = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const dateIso = isoFromDate(date);
    const dayPosts = filteredPosts()
      .filter((post) => post.date === dateIso)
      .sort((a, b) => a.platform.localeCompare(b.platform));
    const outside = date.getMonth() !== month ? " outside" : "";
    const todayClass = dateIso === todayIso ? " today" : "";
    return `
      <section class="day-cell${outside}${todayClass}${dateIso === selectedDateIso ? " selected" : ""}" onclick="selectCalendarDay('${dateIso}')">
        <div class="day-number">${date.getDate()}</div>
        <div class="day-posts">
          ${dayPosts.map((post) => renderMiniPost(post)).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function renderMiniPost(post) {
  const info = platformInfo[post.platform];
  const formatClass = getFormatClass(post);
  return `
    <button class="post-card ${info.className}" type="button" onclick="event.stopPropagation(); selectPost('${post.id}')">
      <div class="post-top">
        <span>${escapeHtml(post.platform)}</span>
        <small class="status ${statusClass(post.status)}">${escapeHtml(statusLabel(post.status))}</small>
      </div>
      <small class="publish-time">${escapeHtml(post.time || "09:00")}</small>
      ${renderMedia(post, `mini ${formatClass}`)}
      <strong>${escapeHtml(post.title)}</strong>
      <p>${escapeHtml(post.caption || info.hint)}</p>
      ${post.comments && post.comments.length ? `<em>${post.comments.length} komentár(e)</em>` : ""}
    </button>
  `;
}

function renderSelected() {
  const baseSelected = posts.find((post) => post.id === selectedId) || filteredMonthPosts()[0];
  const selected = getEditingPreviewPost(baseSelected);
  const panel = document.getElementById("selected-preview");
  if (!selected) {
    panel.innerHTML = `
      <div class="empty-state">
        <strong>Zatiaľ nič v pláne.</strong>
        <p>Pridaj prvý post alebo použi jednu z ukážok vľavo.</p>
      </div>
    `;
    return;
  }

  selectedId = selected.id;
  const info = platformInfo[selected.platform];
  const formatClass = getFormatClass(selected);
  panel.innerHTML = `
    <article class="large-post ${info.className}">
      <div class="large-top">
        <span class="avatar"></span>
        <div>
          <strong>${escapeHtml(selected.platform)} preview</strong>
          <small>${escapeHtml(selected.format)} · ${formatDate(selected.date)} · ${escapeHtml(selected.time || "09:00")} · ${escapeHtml(statusLabel(selected.status))}</small>
        </div>
      </div>
      ${renderMedia(selected, `large ${formatClass}`)}
      <h3>${escapeHtml(selected.title)}</h3>
      <p>${escapeHtml(selected.caption || info.hint)}</p>
      <div class="comment-thread">
        <strong>Komentáre a pripomienky</strong>
        ${renderComments(selected)}
      </div>
      <label>
        Nová pripomienka
        <textarea id="review-comment" rows="4" placeholder="Napr. skrátiť text, vymeniť úvod, posunúť dátum..."></textarea>
      </label>
      <div class="preview-actions">
        <button type="button" onclick="approvePost('${selected.id}')">Schváliť</button>
        <button type="button" class="secondary" onclick="requestEdit('${selected.id}')">Poslať pripomienku</button>
        <button type="button" class="secondary" onclick="editPost('${selected.id}')">Upraviť príspevok</button>
        <button type="button" class="secondary" onclick="deletePost('${selected.id}')">Vymazať</button>
      </div>
    </article>
  `;
}

function renderMedia(post, size) {
  const mediaItems = getMediaItems(post);
  if (!mediaItems.length) {
    const hasMissingNamedFile = Boolean(post.mediaName);
    const placeholderText = hasMissingNamedFile
      ? `${post.mediaType?.startsWith("video/") ? "Video" : "Fotka"} nie je v kóde: ${shortFileName(post.mediaName)}`
      : post.platform;
    const placeholderClass = post.mediaType?.startsWith("video/") ? "video-placeholder" : hasMissingNamedFile ? "missing-media" : "";
    return `<div class="media-placeholder ${size} ${placeholderClass}"><span title="${escapeHtml(placeholderText)}">${escapeHtml(placeholderText)}</span></div>`;
  }

  const first = mediaItems[0];
  const badge = mediaItems.length > 1 ? `<span class="carousel-badge">${mediaItems.length}</span>` : "";
  if (mediaItems.length > 1 && size.includes("large")) {
    return `
      <div class="carousel-view">
        ${mediaItems
          .map((item, index) => {
            const slide = item.type.startsWith("video/")
              ? `<video class="media ${size}" src="${item.url}" muted controls></video>`
              : `<img class="media ${size}" src="${item.url}" alt="" />`;
            return `<div class="carousel-slide">${slide}<span>${index + 1} / ${mediaItems.length}</span></div>`;
          })
          .join("")}
      </div>
    `;
  }
  const main = first.type.startsWith("video/")
    ? `<video class="media ${size}" src="${first.url}" muted controls></video>`
    : `<img class="media ${size}" src="${first.url}" alt="" />`;
  const thumbs = mediaItems.length > 1 && size.includes("large")
    ? `<div class="carousel-thumbs">${mediaItems
        .slice(0, 6)
        .map((item, index) =>
          item.type.startsWith("video/")
            ? `<span class="thumb video-thumb">${index + 1}</span>`
            : `<img class="thumb" src="${item.url}" alt="" />`,
        )
        .join("")}</div>`
    : "";

  return `<div class="media-frame">${main}${badge}</div>${thumbs}`;
}

window.selectPost = (id) => {
  selectedId = id;
  renderSelected();
};

window.selectCalendarDay = (dateIso) => {
  selectedDateIso = dateIso;
  currentMonth = new Date(`${dateIso}T00:00:00`);
  currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  form.elements.date.value = dateIso;
  selectedId = null;
  resetComposer(false);
  form.elements.date.value = dateIso;
  setFormStatus(`Plánuješ príspevok na ${formatDate(dateIso)}.`);
  render();
  renderComposerPreviews();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.setStatus = (id, status) => {
  const post = posts.find((item) => item.id === id);
  if (!post) return;
  post.status = status;
  savePosts();
  render();
};

window.approvePost = (id) => {
  saveReviewState(id, "Approved");
};

window.requestEdit = (id) => {
  saveReviewState(id, "Needs edit");
};

window.deletePost = (id) => {
  posts = posts.filter((post) => post.id !== id);
  selectedId = null;
  if (form.elements.editingId.value === id) resetComposer();
  savePosts();
  render();
};

window.editPost = (id) => {
  const post = posts.find((item) => item.id === id);
  if (!post) return;
  form.elements.editingId.value = post.id;
  form.elements.platform.value = post.platform;
  form.elements.format.value = post.format;
  form.elements.date.value = post.date;
  form.elements.time.value = post.time || "09:00";
  form.elements.title.value = post.title;
  form.elements.caption.value = post.caption;
  document.getElementById("form-title").textContent = "Upraviť príspevok";
  document.getElementById("save-post-button").textContent = "Uložiť úpravu";
  document.getElementById("cancel-edit").classList.remove("hidden");
  setFormStatus(post.mediaName ? `Aktuálne médium: ${post.mediaName}. Nový súbor ho nahradí.` : "Upravuješ existujúci príspevok.");
  stagedMediaItems = [];
  renderMediaList();
  renderComposerPreviews();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
};

window.removeStagedMedia = (index) => {
  stagedMediaItems.splice(index, 1);
  renderMediaList();
  saveMediaToEditingPost();
  renderComposerPreviews();
};

window.deleteComment = (postId, commentId) => {
  const post = posts.find((item) => item.id === postId);
  if (!post) return;
  post.comments = normalizeComments(post).filter((comment) => comment.id !== commentId);
  savePosts();
  render();
};

function filteredPosts() {
  if (activeFilter === "All") return posts;
  return posts.filter((post) => post.platform === activeFilter);
}

function setActiveFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll("[data-filter]").forEach((item) => {
    item.classList.toggle("active", item.dataset.filter === filter);
  });
}

function filteredMonthPosts() {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  return filteredPosts().filter((post) => {
    const date = new Date(`${post.date}T00:00:00`);
    return date.getFullYear() === year && date.getMonth() === month;
  });
}

function seedTemplatePosts() {
  return Object.entries(templates).map(([platform, template], index) => ({
    id: crypto.randomUUID(),
    platform,
    title: template.title,
    format: template.format,
    caption: template.caption,
    date: isoDate(currentMonth.getFullYear(), currentMonth.getMonth(), 4 + index * 5),
    media: null,
    mediaType: "",
    mediaName: "",
    mediaItems: [],
    status: "Draft",
    comment: "",
    comments: [],
  }));
}

function exportXls() {
  const rows = filteredMonthPosts();
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          table { border-collapse: collapse; font-family: Arial, sans-serif; }
          th { background: #1d1d24; color: #ffffff; }
          th, td { border: 1px solid #bfc5d2; padding: 8px; vertical-align: top; }
        </style>
      </head>
      <body>
        <table>
          <thead>
            <tr>
              <th>Dátum</th>
              <th>Čas</th>
              <th>Sieť</th>
              <th>Formát</th>
              <th>Názov</th>
              <th>Text príspevku</th>
              <th>Stav</th>
              <th>Komentáre</th>
              <th>Médiá</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(renderXlsRow).join("")}
          </tbody>
        </table>
      </body>
    </html>
  `;
  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `content-plan-${currentMonth.getFullYear()}-${String(currentMonth.getMonth() + 1).padStart(2, "0")}.xls`;
  link.click();
  URL.revokeObjectURL(url);
}

function renderXlsRow(row) {
  const comments = normalizeComments(row).map((comment) => comment.text).join("\n");
  const mediaNames = getMediaItems(row).map((item) => item.name || "médium").join("\n");
  return `
    <tr>
      <td>${escapeHtml(formatDate(row.date))}</td>
      <td>${escapeHtml(row.time || "09:00")}</td>
      <td>${escapeHtml(row.platform || "")}</td>
      <td>${escapeHtml(row.format || "")}</td>
      <td>${escapeHtml(row.title || "")}</td>
      <td>${escapeHtml(row.caption || "")}</td>
      <td>${escapeHtml(statusLabel(row.status || "Draft"))}</td>
      <td>${escapeHtml(comments)}</td>
      <td>${escapeHtml(mediaNames)}</td>
    </tr>
  `;
}

function openShareDialog() {
  const dialog = document.getElementById("share-dialog");
  const sharePayload = createSharePayload();
  document.getElementById("share-code").value = encodeSharePayload(sharePayload);
  document.getElementById("share-status").textContent = "";
  document.getElementById("share-media-status").textContent = getShareMediaStatus(sharePayload);
  if (dialog.showModal) {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

async function copyShareCode() {
  const code = document.getElementById("share-code").value;
  try {
    await navigator.clipboard.writeText(code);
    document.getElementById("share-status").textContent = "Kód je skopírovaný.";
  } catch {
    document.getElementById("share-status").textContent = "Kód označ a skopíruj ručne.";
  }
}

function importShareCode() {
  const code = document.getElementById("import-code").value.trim();
  const status = document.getElementById("share-status");
  try {
    const decoded = JSON.parse(decodeURIComponent(escape(atob(code))));
    if (!Array.isArray(decoded.posts)) throw new Error("Invalid share code");
    posts = decoded.posts.map((post) => {
      const mediaItems = normalizeSharedMediaItems(post);
      const firstMedia = mediaItems[0] || null;
      return {
        id: post.id || crypto.randomUUID(),
        platform: post.platform || "Instagram",
        title: post.title || "Bez názvu",
        format: post.format || "Photo post",
        caption: post.caption || "",
        date: post.date || planningStartIso,
        time: post.time || "09:00",
        media: firstMedia?.url || null,
        mediaType: firstMedia?.type || post.mediaType || "",
        mediaName: firstMedia?.name || post.mediaName || "",
        mediaItems,
        status: post.status || "Draft",
        comments: normalizeComments(post),
      };
    });
    selectedId = null;
    savePosts();
    render();
    const sharePayload = createSharePayload();
    document.getElementById("share-code").value = encodeSharePayload(sharePayload);
    document.getElementById("share-media-status").textContent = getShareMediaStatus(sharePayload);
    const missingCount = posts.filter((post) => post.mediaName && !getMediaItems(post).length).length;
    status.textContent = missingCount
      ? `Plán je načítaný. ${missingCount} médium nemá súbor v tomto share kóde.`
      : "Plán je načítaný. Fotky zo share kódu sa zobrazia v náhľadoch.";
  } catch {
    status.textContent = "Tento kód sa nepodarilo načítať.";
  }
}

function openCloudDialog() {
  renderCloudState();
  const dialog = document.getElementById("cloud-dialog");
  if (dialog.showModal) {
    dialog.showModal();
  } else {
    dialog.setAttribute("open", "");
  }
}

async function getCloudClient() {
  if (supabaseClient) return supabaseClient;
  const hasConfig = cloudConfig.url && cloudConfig.anonKey;
  if (!hasConfig) return null;
  if (!window.supabase?.createClient) {
    try {
      const supabaseModule = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm");
      window.supabase = supabaseModule;
    } catch {
      return null;
    }
  }
  supabaseClient = window.supabase.createClient(cloudConfig.url, cloudConfig.anonKey);
  return supabaseClient;
}

async function initCloud() {
  const client = await getCloudClient();
  renderCloudState();
  if (!client) return;

  const { data } = await client.auth.getSession();
  cloudSession = data.session || null;
  client.auth.onAuthStateChange((_event, session) => {
    cloudSession = session;
    renderCloudState();
  });
  renderCloudState();
}

function renderCloudState(message = "") {
  const status = document.getElementById("cloud-status");
  if (!status) return;

  const configured = Boolean(cloudConfig.url && cloudConfig.anonKey);
  const connected = configured && cloudSession && cloudWorkspace?.id;
  status.textContent = connected
    ? "Cloud zapnutý"
    : configured
    ? "Supabase pripravený"
    : "Lokálny režim";
  status.className = `cloud-pill ${connected || configured ? "ready" : "local"}`;

  document.getElementById("cloud-current-user").textContent = cloudSession?.user?.email
    ? `Prihlásená ako ${cloudSession.user.email}`
    : "Nie si prihlásená.";
  document.getElementById("cloud-current-code").textContent = cloudWorkspace?.join_code || "zatiaľ žiadny";
  document.getElementById("cloud-actions-status").textContent =
    message ||
    (configured
      ? "Po vytvorení alebo pripojení workspace sa zmeny ukladajú aj do cloudu."
      : "Cloud ešte nie je nakonfigurovaný. Použi SQL a config nižšie.");
}

async function sendMagicLink() {
  const status = document.getElementById("cloud-login-status");
  const client = await getCloudClient();
  if (!client) {
    status.textContent = cloudConfig.url && cloudConfig.anonKey
      ? "Supabase knižnica sa nepodarila načítať. Skontroluj internet alebo CDN."
      : "Najprv vlož Supabase URL a anon key do supabase-config.js.";
    renderCloudState();
    return;
  }

  const email = document.getElementById("cloud-email").value.trim();
  if (!email) {
    status.textContent = "Doplň e-mail, kam príde prihlasovací odkaz.";
    return;
  }

  const { error } = await client.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href },
  });
  status.textContent = error
    ? `Magic link sa nepodarilo poslať: ${error.message}`
    : "Magic link je odoslaný. Otvor e-mail a vráť sa späť do appky.";
}

async function signOutCloud() {
  const client = await getCloudClient();
  if (!client) return;
  await client.auth.signOut();
  cloudSession = null;
  renderCloudState("Si odhlásená. Lokálne dáta v prehliadači ostali.");
}

async function createCloudWorkspace() {
  const client = await getCloudClient();
  if (!client || !cloudSession) {
    renderCloudState("Najprv zapni Supabase config a prihlás sa e-mailom.");
    return;
  }

  const name = document.getElementById("cloud-workspace-name").value.trim() || "Content plán";
  const joinCode = createWorkspaceCode();
  const { data, error } = await client
    .from("workspaces")
    .insert({
      name,
      join_code: joinCode,
      payload: getCloudPayload(),
    })
    .select("id, name, join_code, updated_at")
    .single();

  if (error) {
    renderCloudState(`Cloud plán sa nepodarilo vytvoriť: ${error.message}`);
    return;
  }

  setCloudWorkspace(data);
  renderCloudState(`Cloud plán je vytvorený. Kód ${data.join_code} pošli klientovi alebo kolegyni.`);
}

async function joinCloudWorkspace() {
  const client = await getCloudClient();
  if (!client || !cloudSession) {
    renderCloudState("Najprv sa prihlás e-mailom.");
    return;
  }

  const code = document.getElementById("cloud-join-code").value.trim().toUpperCase();
  if (!code) {
    renderCloudState("Vlož workspace kód, ktorý dostaneš od druhej osoby.");
    return;
  }

  const { data: workspaceId, error: joinError } = await client.rpc("join_workspace", { p_join_code: code });
  if (joinError) {
    renderCloudState(`Nepodarilo sa pripojiť: ${joinError.message}`);
    return;
  }

  const { data, error } = await client
    .from("workspaces")
    .select("id, name, join_code, payload, updated_at")
    .eq("id", workspaceId)
    .single();
  if (error) {
    renderCloudState(`Workspace je pridaný, ale nepodarilo sa načítať plán: ${error.message}`);
    return;
  }

  setCloudWorkspace(data);
  applyCloudPayload(data.payload);
  renderCloudState(`Pripojené ku kódu ${data.join_code}. Plán je načítaný.`);
}

async function loadCloudWorkspace() {
  const client = await getCloudClient();
  if (!client || !cloudSession || !cloudWorkspace?.id) {
    renderCloudState("Najprv sa prihlás a vytvor alebo pripoj workspace.");
    return;
  }

  const { data, error } = await client
    .from("workspaces")
    .select("id, name, join_code, payload, updated_at")
    .eq("id", cloudWorkspace.id)
    .single();
  if (error) {
    renderCloudState(`Cloud plán sa nepodarilo načítať: ${error.message}`);
    return;
  }

  setCloudWorkspace(data);
  applyCloudPayload(data.payload);
  renderCloudState(`Cloud plán je načítaný. Posledná zmena: ${formatCloudDate(data.updated_at)}.`);
}

async function saveCloudWorkspace() {
  const client = await getCloudClient();
  if (!client || !cloudSession || !cloudWorkspace?.id) {
    renderCloudState("Najprv sa prihlás a vytvor alebo pripoj workspace.");
    return;
  }

  const { data, error } = await client
    .from("workspaces")
    .update({
      payload: getCloudPayload(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", cloudWorkspace.id)
    .select("id, name, join_code, updated_at")
    .single();
  if (error) {
    renderCloudState(`Cloud uloženie zlyhalo: ${error.message}`);
    return;
  }

  setCloudWorkspace(data);
  renderCloudState(`Uložené v cloude. Kód na zdieľanie: ${data.join_code}.`);
}

function queueCloudSave() {
  if (isApplyingCloudPayload || !cloudWorkspace?.id || !cloudSession || !cloudConfig.url || !cloudConfig.anonKey) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    saveCloudWorkspace();
  }, 900);
}

function setCloudWorkspace(workspace) {
  cloudWorkspace = workspace
    ? {
        id: workspace.id,
        name: workspace.name,
        join_code: workspace.join_code,
        updated_at: workspace.updated_at,
      }
    : null;
  localStorage.setItem("sharetable-cloud-workspace", JSON.stringify(cloudWorkspace));
}

function getCloudPayload() {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    month: isoDate(currentMonth.getFullYear(), currentMonth.getMonth(), 1),
    selectedDateIso,
    posts: posts.map(cloudSerializablePost),
  };
}

function applyCloudPayload(payload) {
  if (!payload || !Array.isArray(payload.posts)) return;
  isApplyingCloudPayload = true;
  posts = payload.posts.map((post) => ({
    ...post,
    id: post.id || crypto.randomUUID(),
    comments: normalizeComments(post),
    mediaItems: Array.isArray(post.mediaItems) ? post.mediaItems : [],
  }));
  selectedId = null;
  selectedDateIso = payload.selectedDateIso || planningStartIso;
  if (payload.month) {
    const nextMonth = new Date(`${payload.month}T00:00:00`);
    currentMonth = new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1);
  }
  savePosts();
  isApplyingCloudPayload = false;
  render();
  renderComposerPreviews();
}

function createWorkspaceCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(6)), (value) => alphabet[value % alphabet.length]);
  return `PLAN-${chars.join("")}`;
}

async function copySupabaseSql() {
  await copyTextFromFile("./supabase-schema.sql", "SQL schéma je skopírovaná.", "SQL sa nepodarilo načítať.");
}

async function copySupabaseConfig() {
  await copyTextFromFile(
    "./supabase-config.example.js",
    "Config vzor je skopírovaný.",
    "Config vzor sa nepodarilo načítať.",
  );
}

async function copyTextFromFile(path, okMessage, errorMessage) {
  const status = document.getElementById("cloud-actions-status");
  try {
    const response = await fetch(path);
    if (!response.ok) throw new Error("missing file");
    await navigator.clipboard.writeText(await response.text());
    status.textContent = okMessage;
  } catch {
    status.textContent = errorMessage;
  }
}

function formatCloudDate(value) {
  return new Date(value || Date.now()).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function createSharePayload() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    posts: posts.map(shareSerializablePost),
  };
}

function createShareCode() {
  return encodeSharePayload(createSharePayload());
}

function encodeSharePayload(payload) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
}

function getShareMediaStatus(payload) {
  const includedPhotos = payload.posts.reduce((count, post) => {
    return count + getMediaItems(post).filter((item) => item.url?.startsWith("data:image/")).length;
  }, 0);
  const missingNamedMedia = payload.posts.filter((post) => post.mediaName && !getMediaItems(post).length).length;
  if (includedPhotos && missingNamedMedia) {
    return `V kóde je ${includedPhotos} fotka/fotiek. ${missingNamedMedia} médium má iba názov súboru.`;
  }
  if (includedPhotos) return `V kóde je ${includedPhotos} fotka/fotiek. Po načítaní sa zobrazia v náhľadoch.`;
  if (missingNamedMedia) return `${missingNamedMedia} médium má iba názov súboru. Vygeneruj nový kód z plánu, kde je fotka ešte nahratá.`;
  return "V tomto kóde nie sú vložené fotky.";
}

function loadPosts() {
  try {
    const stored = JSON.parse(localStorage.getItem("sharetable-simple-posts"));
    return Array.isArray(stored) ? stored : [];
  } catch {
    return [];
  }
}

function loadCloudWorkspaceMeta() {
  try {
    return JSON.parse(localStorage.getItem("sharetable-cloud-workspace") || "null");
  } catch {
    return null;
  }
}

function savePosts() {
  try {
    localStorage.setItem("sharetable-simple-posts", JSON.stringify(posts.map(serializablePost)));
    queueCloudSave();
    return true;
  } catch {
    setFormStatus("Obrázky sú príliš veľké na demo úložisko. V cloud verzii by sa uložili normálne.");
    return false;
  }
}

function serializablePost(post) {
  const mediaItems = getMediaItems(post);
  const persistentItems = mediaItems.filter((item) => item.url && !item.url.startsWith("blob:"));
  return {
    ...post,
    media: post.media && !post.media.startsWith("blob:") ? post.media : null,
    mediaItems: persistentItems,
  };
}

function shareSerializablePost(post) {
  const cleanPost = serializablePost(post);
  const imageItems = getMediaItems(cleanPost).filter((item) => item.url?.startsWith("data:image/") || item.url?.startsWith("https://"));
  const firstImage = imageItems[0] || null;
  return {
    ...cleanPost,
    media: firstImage?.url || null,
    mediaType: firstImage?.type || cleanPost.mediaType || "",
    mediaName: firstImage?.name || cleanPost.mediaName || "",
    mediaItems: imageItems,
  };
}

function normalizeSharedMediaItems(post) {
  const items = Array.isArray(post.mediaItems) ? post.mediaItems : [];
  const sharedItems = items
    .filter((item) => isShareableMediaUrl(item?.url))
    .map((item) => ({
      url: item.url,
      type: item.type || "",
      name: item.name || "",
    }));

  if (!sharedItems.length && isShareableMediaUrl(post.media)) {
    sharedItems.push({
      url: post.media,
      type: post.mediaType || "",
      name: post.mediaName || "",
    });
  }

  return sharedItems;
}

function isShareableMediaUrl(url) {
  return typeof url === "string" && (url.startsWith("data:image/") || url.startsWith("data:video/") || url.startsWith("https://"));
}

function cloudSerializablePost(post) {
  const cleanPost = serializablePost(post);
  return {
    ...cleanPost,
    media: null,
    mediaItems: [],
  };
}

function getMediaItems(post) {
  if (Array.isArray(post.mediaItems) && post.mediaItems.length) return post.mediaItems;
  if (!post.media) return [];
  return [
    {
      url: post.media,
      type: post.mediaType || "",
      name: post.mediaName || "",
    },
  ];
}

function saveReviewState(id, status, onlyComment = false) {
  const post = posts.find((item) => item.id === id);
  if (!post) return;
  const commentInput = document.getElementById("review-comment");
  const value = commentInput ? commentInput.value.trim() : "";
  post.comments = normalizeComments(post);
  if (value) {
    post.comments.push({
      id: crypto.randomUUID(),
      text: value,
      createdAt: new Date().toISOString(),
    });
  }
  if (status) post.status = status;
  if (onlyComment && !status && post.status === "Draft" && value) post.status = "Needs edit";
  savePosts();
  render();
}

function renderComments(post) {
  const comments = normalizeComments(post);
  if (!comments.length) {
    return `<p class="no-comments">Zatiaľ bez pripomienok.</p>`;
  }
  return comments
    .map(
      (comment) => `
        <article class="comment-item">
          <div>
            <p>${escapeHtml(comment.text)}</p>
            <small>${formatCommentDate(comment.createdAt)}</small>
          </div>
          <button type="button" class="tiny-button" onclick="deleteComment('${post.id}', '${comment.id}')">Vymazať</button>
        </article>
      `,
    )
    .join("");
}

function normalizeComments(post) {
  const comments = Array.isArray(post.comments) ? post.comments : [];
  if (post.comment && !comments.some((item) => item.text === post.comment)) {
    comments.unshift({
      id: crypto.randomUUID(),
      text: post.comment,
      createdAt: new Date().toISOString(),
    });
  }
  return comments;
}

function getFormatClass(post) {
  if (post.platform === "TikTok") return "vertical";
  if (post.format.includes("Story") || post.format.includes("Reel")) return "vertical";
  if (post.platform === "LinkedIn") return "textlike";
  if (post.platform === "Facebook") return "wide";
  return "square";
}

function nextStatusAfterEdit(existing) {
  if (!existing) return "Draft";
  if (existing.status === "Approved") return "Draft";
  if (existing.status === "Needs edit" || existing.status === "Revised") return "Revised";
  return existing.status || "Draft";
}

function statusMessageAfterEdit(status) {
  if (status === "Revised") return "Pripomienky sú zapracované.";
  if (status === "Draft") return "Príspevok je upravený a čaká na nové schválenie.";
  return "Príspevok je upravený.";
}

function statusLabel(status) {
  if (status === "Approved") return "Schválené";
  if (status === "Needs edit") return "Pripomienky";
  if (status === "Revised") return "Zapracované pripomienky";
  return "Koncept";
}

function statusClass(status) {
  if (status === "Approved") return "approved";
  if (status === "Needs edit") return "needs-edit";
  if (status === "Revised") return "revised";
  return "draft";
}

function setFormStatus(message) {
  const status = document.getElementById("form-status");
  status.textContent = message;
  status.classList.toggle(
    "saved",
      message.includes("pridaný") ||
      message.includes("upravený") ||
      message.includes("zapracované") ||
      message.includes("uložené") ||
      message.includes("uložíš"),
  );
}

function resetComposer(resetDate = true) {
  form.reset();
  form.elements.editingId.value = "";
  if (resetDate) dateInput.value = getDefaultDateForCurrentMonth();
  stagedMediaItems = [];
  renderMediaList();
  renderComposerPreviews();
  document.getElementById("form-title").textContent = "Pridať príspevok";
  document.getElementById("save-post-button").textContent = "Uložiť do mesiaca";
  document.getElementById("cancel-edit").classList.add("hidden");
}

function renderMediaList() {
  const list = document.getElementById("media-list");
  list.innerHTML = stagedMediaItems
    .map((item, index) => {
      const preview = item.type.startsWith("video/")
        ? `<span class="media-chip-video"></span>`
        : `<img src="${item.url}" alt="" />`;
      return `
        <div class="media-chip">
          ${preview}
          <span>${escapeHtml(index + 1)}. ${escapeHtml(item.name || "Médium")}</span>
          <button type="button" onclick="removeStagedMedia(${index})">Vymazať</button>
        </div>
      `;
    })
    .join("");
}

function saveMediaToEditingPost() {
  const editingId = form.elements.editingId.value;
  if (!editingId) return;
  const post = posts.find((item) => item.id === editingId);
  if (!post) return;
  const first = stagedMediaItems[0] || null;
  post.mediaItems = [...stagedMediaItems];
  post.media = first?.url || null;
  post.mediaType = first?.type || "";
  post.mediaName = first?.name || "";
  post.status = nextStatusAfterEdit(post);
  selectedId = post.id;
  savePosts();
  render();
}

function fileToStoredMediaItem(file) {
  if (file.type.startsWith("image/")) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () =>
        resolve({
          url: reader.result,
          type: file.type,
          name: file.name,
        });
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  return Promise.resolve({
    url: URL.createObjectURL(file),
    type: file.type,
    name: file.name,
  });
}

function renderDraftPreview() {
  const fakePost = getDraftPostFromForm();
  const info = platformInfo[fakePost.platform];
  document.getElementById("draft-preview").innerHTML = `
    <article class="draft-card ${info.className}">
      <div class="post-top">
        <span>${escapeHtml(fakePost.platform)}</span>
        <small>${escapeHtml(fakePost.format)}</small>
      </div>
      ${renderMedia(fakePost, `mini ${getFormatClass(fakePost)}`)}
      <strong>${escapeHtml(fakePost.title)}</strong>
      <p>${escapeHtml(fakePost.caption)}</p>
    </article>
  `;
}

function renderComposerPreviews() {
  renderDraftPreview();
  if (form.elements.editingId.value) renderSelected();
}

function getDraftPostFromForm(existing = null) {
  const platform = form.elements.platform.value || existing?.platform || "Instagram";
  const mediaItems = stagedMediaItems.length ? stagedMediaItems : getMediaItems(existing || {});
  return {
    id: existing?.id || "draft",
    platform,
    format: form.elements.format.value || existing?.format || "Photo post",
    title: form.elements.title.value.trim() || existing?.title || "Názov príspevku",
    caption: form.elements.caption.value.trim() || existing?.caption || platformInfo[platform].hint,
    date: form.elements.date.value || existing?.date || getDefaultDateForCurrentMonth(),
    time: form.elements.time.value || existing?.time || "09:00",
    media: mediaItems[0]?.url || null,
    mediaType: mediaItems[0]?.type || "",
    mediaName: mediaItems[0]?.name || "",
    mediaItems,
    status: existing?.status || "Draft",
    comments: existing?.comments || [],
  };
}

function getEditingPreviewPost(selected) {
  if (!selected) return null;
  if (form.elements.editingId.value !== selected.id) return selected;
  return getDraftPostFromForm(selected);
}

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function isoFromDate(date) {
  return isoDate(date.getFullYear(), date.getMonth(), date.getDate());
}

function getDefaultDateForCurrentMonth() {
  const sameMonth =
    currentMonth.getFullYear() === today.getFullYear() &&
    currentMonth.getMonth() === today.getMonth();
  const planningMonth =
    currentMonth.getFullYear() === planningStart.getFullYear() &&
    currentMonth.getMonth() === planningStart.getMonth();
  if (planningMonth) return planningStartIso;
  return sameMonth ? todayIso : isoDate(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
}

function formatDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatCommentDate(value) {
  return new Date(value || Date.now()).toLocaleString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortFileName(value) {
  const fileName = String(value || "").split(/[\\/]/).pop();
  if (fileName.length <= 24) return fileName;
  const dotIndex = fileName.lastIndexOf(".");
  const extension = dotIndex > -1 ? fileName.slice(dotIndex) : "";
  return `${fileName.slice(0, 16)}...${extension}`;
}

render();
renderDraftPreview();
initCloud();
