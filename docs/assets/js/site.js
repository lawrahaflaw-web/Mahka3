/* ============================================================
   مَحكى — طبقة البيانات للموقع الثابت (Static)
   كل البيانات تُقرأ من ملفات data/*.json داخل نفس المستودع.
   نضيف طابعًا زمنيًا (cache-bust) حتى تظهر التحديثات فورًا بعد أي
   تعديل من لوحة التحكم، بدل ما يبقى المتصفح يعرض نسخة قديمة مخزّنة.
   ============================================================ */

const Mahka = (() => {
  const ROOT = window.MAHKA_ROOT || ""; // من صفحات فرعية (admin/) نمرر "../"

  async function loadJSON(path) {
    const res = await fetch(`${ROOT}data/${path}?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`تعذّر تحميل ${path}`);
    return res.json();
  }

  async function getStories() { return loadJSON("stories.json"); }
  async function getCategories() { return loadJSON("categories.json"); }
  async function getSettings() { return loadJSON("settings.json"); }

  function uploadUrl(relativePath) {
    if (!relativePath) return "";
    return `${ROOT}${relativePath}`;
  }

  function applySettingsToDom(settings) {
    document.title = settings.meta_title || settings.site_name;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) metaDesc.setAttribute("content", settings.meta_description || "");

    document.querySelectorAll("[data-site-name]").forEach(el => el.textContent = settings.site_name);
    document.querySelectorAll("[data-site-tagline]").forEach(el => el.textContent = settings.site_tagline);
    document.querySelectorAll("[data-site-description]").forEach(el => el.textContent = settings.site_description);
    document.querySelectorAll("[data-hero-cta]").forEach(el => el.textContent = settings.hero_cta_text);
    document.querySelectorAll("[data-about-text]").forEach(el => el.textContent = settings.about_text);
    document.querySelectorAll("[data-footer-text]").forEach(el => el.textContent = settings.footer_text);
    document.querySelectorAll("[data-current-year]").forEach(el => el.textContent = new Date().getFullYear());

    const logoEl = document.querySelector("[data-site-logo]");
    if (logoEl) {
      if (settings.logo_path) {
        logoEl.src = uploadUrl(settings.logo_path);
        logoEl.hidden = false;
      } else {
        logoEl.hidden = true;
      }
    }
  }

  function storyCardHTML(story, categoriesById) {
    const cat = categoriesById[story.category_id];
    const catChip = cat ? `<span class="story-chip">${escapeHtml(cat.name)}</span>` : "";
    const coverInner = story.cover_path
      ? `<img src="${uploadUrl(story.cover_path)}" alt="${escapeHtml(story.title)}" loading="lazy">`
      : `<div class="cover-placeholder">${escapeHtml(story.title[0] || "؟")}</div>`;
    const minutes = story.duration_seconds ? Math.floor(story.duration_seconds / 60) : null;

    return `
    <article class="story-card">
      <a href="${ROOT}story/index.html?slug=${encodeURIComponent(story.slug)}" class="story-card-cover">
        ${coverInner}
        <span class="play-badge"
          data-play-story
          data-title="${escapeHtml(story.title)}"
          data-narrator="${escapeHtml(story.narrator || "")}"
          data-cover="${story.cover_path ? uploadUrl(story.cover_path) : ""}"
          data-audio="${story.audio_path ? uploadUrl(story.audio_path) : ""}">▶</span>
      </a>
      <div class="story-card-body">
        ${catChip}
        <h3><a href="${ROOT}story/index.html?slug=${encodeURIComponent(story.slug)}">${escapeHtml(story.title)}</a></h3>
        <div class="story-meta">
          ${story.narrator ? `<span>${escapeHtml(story.narrator)}</span>` : ""}
          ${minutes ? `<span>${minutes} د</span>` : ""}
        </div>
      </div>
    </article>`;
  }

  function escapeHtml(str) {
    return String(str || "").replace(/[&<>"']/g, s => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[s]));
  }

  function categoriesById(categories) {
    const map = {};
    categories.forEach(c => { map[c.id] = c; });
    return map;
  }

  return { getStories, getCategories, getSettings, applySettingsToDom, storyCardHTML, categoriesById, uploadUrl, escapeHtml, ROOT };
})();
