/* ============================================================
   لوحة تحكم مَحكى (نسخة الموقع الثابت)
   كل "حفظ" هنا = Commit مباشر إلى ملفات JSON/الرفوعات داخل مستودع
   GitHub الخاص بك، عبر GitHub REST API. لا يوجد سيرفر خلفي منفصل.
   ============================================================ */

const CFG_KEY = "mahka_admin_config";
const ALLOWED_COVER_EXT = ["jpg", "jpeg", "png", "webp"];
const ALLOWED_AUDIO_EXT = ["mp3", "wav", "m4a", "ogg"];
const MAX_COVER_MB = 5;
const MAX_AUDIO_MB = 25; // أقل من الباك-إند الأصلي عمدًا لتفادي بطء التشفير Base64 داخل المتصفح

const IMAGE_SIGS = [
  { bytes: [0xff, 0xd8, 0xff], ext: "jpg" },
  { bytes: [0x89, 0x50, 0x4e, 0x47], ext: "png" },
  { bytes: [0x52, 0x49, 0x46, 0x46], ext: "webp" },
];
const AUDIO_SIGS = [
  { bytes: [0x49, 0x44, 0x33], ext: "mp3" },
  { bytes: [0xff, 0xfb], ext: "mp3" },
  { bytes: [0x52, 0x49, 0x46, 0x46], ext: "wav" },
  { bytes: [0x4f, 0x67, 0x67, 0x53], ext: "ogg" },
];

let state = { config: null, stories: [], categories: [], settings: {}, shas: {} };

// ---------- أدوات عامة ----------

function loadConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY) || "null"); } catch { return null; }
}
function saveConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }
function clearConfig() { localStorage.removeItem(CFG_KEY); }

function b64EncodeUnicode(str) {
  return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode(parseInt(p1, 16))));
}
function b64DecodeUnicode(str) {
  const clean = str.replace(/\n/g, "");
  return decodeURIComponent(atob(clean).split("").map(c => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""));
}
function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
function slugify(text) {
  text = (text || "").trim().replace(/\s+/g, "-").replace(/[^\w\u0600-\u06FF-]/g, "");
  return text.toLowerCase() || "item";
}
function uid() { return Math.random().toString(16).slice(2) + Date.now().toString(16); }
function nowIso() { return new Date().toISOString(); }
function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, s => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s]));
}
function toast(msg, type = "success") {
  const box = document.getElementById("toastBox");
  const el = document.createElement("div");
  el.className = `flash flash-${type}`;
  el.textContent = msg;
  box.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

// ---------- GitHub API ----------

function apiBase() {
  const { owner, repo } = state.config;
  return `https://api.github.com/repos/${owner}/${repo}`;
}

async function ghRequest(path, options = {}) {
  const res = await fetch(`${apiBase()}${path}`, {
    ...options,
    headers: {
      "Authorization": `token ${state.config.token}`,
      "Accept": "application/vnd.github+json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

async function ghGetFile(path) {
  try {
    const data = await ghRequest(`/contents/${path}?ref=${state.config.branch}`);
    return { content: b64DecodeUnicode(data.content), sha: data.sha };
  } catch (e) {
    if (e.message.includes("404")) return { content: null, sha: null };
    throw e;
  }
}

async function ghPutText(path, textContent, message) {
  const sha = state.shas[path];
  const body = {
    message,
    content: b64EncodeUnicode(textContent),
    branch: state.config.branch,
  };
  if (sha) body.sha = sha;
  const res = await ghRequest(`/contents/${path}`, { method: "PUT", body: JSON.stringify(body) });
  state.shas[path] = res.content.sha;
  return res;
}

async function ghPutBinaryBase64(path, base64Content, message) {
  const body = { message, content: base64Content, branch: state.config.branch };
  const res = await ghRequest(`/contents/${path}`, { method: "PUT", body: JSON.stringify(body) });
  return res;
}

// ---------- التحقق من الملفات (نفس منطق الحماية بالخادم، منقول للمتصفح) ----------

function readHeadBytes(file, n = 12) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(new Uint8Array(reader.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file.slice(0, n));
  });
}

function matchesSignature(head, sigs) {
  return sigs.some(sig => sig.bytes.every((b, i) => head[i] === b));
}

async function validateFile(file, kind) {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  const allowed = kind === "cover" ? ALLOWED_COVER_EXT : ALLOWED_AUDIO_EXT;
  const maxMb = kind === "cover" ? MAX_COVER_MB : MAX_AUDIO_MB;
  const sigs = kind === "cover" ? IMAGE_SIGS : AUDIO_SIGS;

  if (!allowed.includes(ext)) throw new Error(`صيغة غير مسموحة. المسموح: ${allowed.join(", ")}`);
  if (file.size === 0) throw new Error("الملف فارغ");
  if (file.size > maxMb * 1024 * 1024) throw new Error(`الحجم يتجاوز الحد المسموح (${maxMb}MB)`);

  const head = await readHeadBytes(file);
  if (!matchesSignature(head, sigs)) {
    throw new Error("محتوى الملف لا يطابق الصيغة المعلنة، تم رفض الرفع لأسباب أمنية");
  }
  return ext;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(arrayBufferToBase64(reader.result));
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function uploadFile(file, kind) {
  const ext = await validateFile(file, kind);
  const subdir = kind === "cover" ? "covers" : "audio";
  const filename = `${uid()}.${ext}`;
  const path = `uploads/${subdir}/${filename}`;
  const base64 = await fileToBase64(file);
  await ghPutBinaryBase64(path, base64, `رفع ملف ${kind === "cover" ? "غلاف" : "صوت"}: ${filename}`);
  return path;
}

// ---------- تحميل/حفظ البيانات ----------

async function loadAll() {
  const [storiesF, categoriesF, settingsF] = await Promise.all([
    ghGetFile("data/stories.json"),
    ghGetFile("data/categories.json"),
    ghGetFile("data/settings.json"),
  ]);
  state.stories = storiesF.content ? JSON.parse(storiesF.content) : [];
  state.categories = categoriesF.content ? JSON.parse(categoriesF.content) : [];
  state.settings = settingsF.content ? JSON.parse(settingsF.content) : {};
  state.shas["data/stories.json"] = storiesF.sha;
  state.shas["data/categories.json"] = categoriesF.sha;
  state.shas["data/settings.json"] = settingsF.sha;
}

async function saveStories(message) {
  await ghPutText("data/stories.json", JSON.stringify(state.stories, null, 2), message);
}
async function saveCategories(message) {
  await ghPutText("data/categories.json", JSON.stringify(state.categories, null, 2), message);
}
async function saveSettings(message) {
  await ghPutText("data/settings.json", JSON.stringify(state.settings, null, 2), message);
}

function uniqueSlug(list, base, excludeId) {
  let slug = base, i = 2;
  while (list.some(item => item.slug === slug && item.id !== excludeId)) {
    slug = `${base}-${i}`; i++;
  }
  return slug;
}
function nextId(list) {
  return list.length ? Math.max(...list.map(i => i.id)) + 1 : 1;
}

// ---------- التصدير للاستخدام من admin.html ----------
window.MahkaAdmin = {
  state, loadConfig, saveConfig, clearConfig, loadAll,
  saveStories, saveCategories, saveSettings,
  uploadFile, validateFile, slugify, uniqueSlug, nextId, uid, nowIso,
  escapeHtml, toast, apiBase, ghRequest,
  setConfig(cfg) { state.config = cfg; },
};
