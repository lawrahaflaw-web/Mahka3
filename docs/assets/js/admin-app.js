const A = window.MahkaAdmin;
let activeTab = "stories";

// ---------- الإقلاع ----------

(function boot() {
  const cfg = A.loadConfig();
  if (cfg) {
    A.setConfig(cfg);
    startDashboard();
  } else {
    document.getElementById("configScreen").hidden = false;
  }
})();

document.getElementById("cfgSubmit").addEventListener("click", async () => {
  const cfg = {
    owner: document.getElementById("cfgOwner").value.trim(),
    repo: document.getElementById("cfgRepo").value.trim(),
    branch: document.getElementById("cfgBranch").value.trim() || "main",
    token: document.getElementById("cfgToken").value.trim(),
  };
  if (!cfg.owner || !cfg.repo || !cfg.token) {
    A.toast("عبّي كل الحقول أولًا", "error");
    return;
  }
  A.setConfig(cfg);
  try {
    await A.ghRequest(""); // اختبار اتصال بسيط
    A.saveConfig(cfg);
    document.getElementById("configScreen").hidden = true;
    startDashboard();
  } catch (e) {
    A.toast("تعذّر الاتصال: تأكدي من اسم المستودع والتوكن. " + e.message, "error");
  }
});

document.getElementById("disconnectBtn").addEventListener("click", (e) => {
  e.preventDefault();
  if (confirm("هل تريدين قطع الاتصال بهذا المستودع من هذا المتصفح؟")) {
    A.clearConfig();
    location.reload();
  }
});

async function startDashboard() {
  document.getElementById("dashboard").hidden = false;
  try {
    await A.loadAll();
  } catch (e) {
    A.toast("فشل تحميل البيانات: " + e.message, "error");
    return;
  }
  wireTabs();
  renderTab("stories");
}

function wireTabs() {
  document.querySelectorAll(".tab-link").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelectorAll(".tab-link").forEach(x => x.classList.remove("active"));
      a.classList.add("active");
      renderTab(a.dataset.tab);
    });
  });
}

function renderTab(tab) {
  activeTab = tab;
  const map = { stories: renderStoriesTab, categories: renderCategoriesTab, settings: renderSettingsTab, help: renderHelpTab };
  map[tab]();
}

// ---------- تبويب القصص ----------

function renderStoriesTab() {
  const content = document.getElementById("tabContent");
  const cats = A.state.categories;
  const catName = (id) => (cats.find(c => c.id === id) || {}).name || "—";

  content.innerHTML = `
    <div class="admin-page-head">
      <h1 class="admin-page-title">القصص</h1>
      <button class="btn-primary" id="newStoryBtn">+ إضافة قصة</button>
    </div>
    <div id="storyFormWrap"></div>
    <table class="admin-table">
      <thead><tr><th>الغلاف</th><th>العنوان</th><th>التصنيف</th><th>الحالة</th><th>مميزة</th><th>الاستماعات</th><th>إجراءات</th></tr></thead>
      <tbody id="storiesBody">
        ${A.state.stories.map(s => `
          <tr data-id="${s.id}">
            <td>${s.cover_path ? `<img class="thumb" src="../${s.cover_path}">` : `<span class="thumb placeholder"></span>`}</td>
            <td>${A.escapeHtml(s.title)}</td>
            <td>${A.escapeHtml(catName(s.category_id))}</td>
            <td><button class="tag-toggle status-toggle ${s.status === 'published' ? 'tag-published' : 'tag-draft'}" data-id="${s.id}">${s.status === 'published' ? 'منشورة' : 'مسودة'}</button></td>
            <td><button class="star-toggle ${s.is_featured ? 'is-featured' : ''}" data-id="${s.id}">★</button></td>
            <td>${s.listens_count || 0}</td>
            <td class="row-actions">
              <button class="link-edit" data-edit="${s.id}" style="background:none;border:none;color:var(--a-gold);cursor:pointer;">تعديل</button>
              <button class="link-danger" data-delete="${s.id}">حذف</button>
            </td>
          </tr>`).join("") || `<tr><td colspan="7" class="muted">لا توجد قصص بعد.</td></tr>`}
      </tbody>
    </table>
  `;

  document.getElementById("newStoryBtn").addEventListener("click", () => showStoryForm(null));
  content.querySelectorAll("[data-edit]").forEach(b => b.addEventListener("click", () => showStoryForm(Number(b.dataset.edit))));
  content.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => deleteStory(Number(b.dataset.delete))));
  content.querySelectorAll(".status-toggle").forEach(b => b.addEventListener("click", () => toggleStoryField(Number(b.dataset.id), "status")));
  content.querySelectorAll(".star-toggle").forEach(b => b.addEventListener("click", () => toggleStoryField(Number(b.dataset.id), "is_featured")));
}

function showStoryForm(id) {
  const story = id ? A.state.stories.find(s => s.id === id) : null;
  const cats = A.state.categories;
  const wrap = document.getElementById("storyFormWrap");

  wrap.innerHTML = `
    <form id="storyForm" class="admin-form" style="margin-bottom:24px;">
      <h2>${story ? "تعديل: " + A.escapeHtml(story.title) : "إضافة قصة جديدة"}</h2>
      <div class="form-grid">
        <div class="form-col">
          <label>عنوان القصة *<input type="text" name="title" required value="${story ? A.escapeHtml(story.title) : ""}"></label>
          <label>الوصف<textarea name="description" rows="4">${story ? A.escapeHtml(story.description || "") : ""}</textarea></label>
          <label>اسم الراوي<input type="text" name="narrator" value="${story ? A.escapeHtml(story.narrator || "") : ""}"></label>
          <label>التصنيف
            <select name="category_id">
              <option value="">بدون تصنيف</option>
              ${cats.map(c => `<option value="${c.id}" ${story && story.category_id === c.id ? "selected" : ""}>${A.escapeHtml(c.name)}</option>`).join("")}
            </select>
          </label>
          <label>مدة القصة (ثواني)<input type="number" name="duration_seconds" min="0" value="${story ? story.duration_seconds || 0 : 0}"></label>
          <label class="checkbox-row"><input type="checkbox" name="is_featured" ${story && story.is_featured ? "checked" : ""}> قصة مميزة</label>
          <label>الحالة
            <select name="status">
              <option value="draft" ${!story || story.status === "draft" ? "selected" : ""}>مسودة</option>
              <option value="published" ${story && story.status === "published" ? "selected" : ""}>منشورة</option>
            </select>
          </label>
        </div>
        <div class="form-col">
          <label>صورة الغلاف ${story ? "(اتركه فارغًا للإبقاء على الحالي)" : "*"}<input type="file" name="cover" accept=".jpg,.jpeg,.png,.webp"></label>
          ${story && story.cover_path ? `<img class="preview-thumb" src="../${story.cover_path}">` : ""}
          <label>الملف الصوتي ${story ? "(اتركه فارغًا للإبقاء على الحالي)" : "*"}<input type="file" name="audio" accept=".mp3,.wav,.m4a,.ogg"></label>
          ${story && story.audio_path ? `<audio controls class="preview-audio" src="../${story.audio_path}"></audio>` : ""}
          <p class="muted small">الغلاف: JPG/PNG/WEBP حتى 5MB. الصوت: MP3/WAV/M4A/OGG حتى 25MB (حد أقل من الخادم التقليدي لأن الرفع هنا يمر عبر متصفحك مباشرة إلى GitHub).</p>
          <div class="upload-progress" id="uploadProgress" hidden></div>
        </div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn-primary" id="storySaveBtn">حفظ</button>
        <button type="button" class="btn-secondary" id="storyCancelBtn">إلغاء</button>
      </div>
    </form>
  `;

  document.getElementById("storyCancelBtn").addEventListener("click", () => { wrap.innerHTML = ""; });

  document.getElementById("storyForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const progress = document.getElementById("uploadProgress");
    const saveBtn = document.getElementById("storySaveBtn");
    saveBtn.disabled = true; saveBtn.textContent = "جارٍ الحفظ…";

    try {
      const coverFile = form.cover.files[0];
      const audioFile = form.audio.files[0];
      if (!story && !audioFile) throw new Error("ملف الصوت مطلوب لإضافة قصة جديدة");

      let coverPath = story ? story.cover_path : "";
      let audioPath = story ? story.audio_path : "";

      if (coverFile) {
        progress.hidden = false; progress.textContent = "جارٍ رفع الغلاف…";
        coverPath = await A.uploadFile(coverFile, "cover");
      }
      if (audioFile) {
        progress.hidden = false; progress.textContent = "جارٍ رفع الملف الصوتي (قد يستغرق دقيقة حسب حجمه)…";
        audioPath = await A.uploadFile(audioFile, "audio");
      }

      const title = form.title.value.trim();
      const baseSlug = A.slugify(title);

      if (story) {
        const originalTitle = story.title;
        story.title = title;
        story.slug = title !== originalTitle ? A.uniqueSlug(A.state.stories, baseSlug, story.id) : story.slug;
        story.description = form.description.value;
        story.narrator = form.narrator.value;
        story.category_id = form.category_id.value ? Number(form.category_id.value) : null;
        story.duration_seconds = Number(form.duration_seconds.value) || 0;
        story.is_featured = form.is_featured.checked;
        story.status = form.status.value;
        story.cover_path = coverPath;
        story.audio_path = audioPath;
        story.updated_at = A.nowIso();
      } else {
        A.state.stories.push({
          id: A.nextId(A.state.stories),
          title, slug: A.uniqueSlug(A.state.stories, baseSlug),
          description: form.description.value, narrator: form.narrator.value,
          category_id: form.category_id.value ? Number(form.category_id.value) : null,
          duration_seconds: Number(form.duration_seconds.value) || 0,
          is_featured: form.is_featured.checked, status: form.status.value,
          cover_path: coverPath, audio_path: audioPath,
          listens_count: 0, sort_order: A.state.stories.length,
          created_at: A.nowIso(), updated_at: A.nowIso(),
        });
      }

      progress.textContent = "جارٍ حفظ التغييرات في المستودع…";
      await A.saveStories(story ? `تعديل قصة: ${title}` : `إضافة قصة: ${title}`);
      A.toast("تم الحفظ بنجاح ✅");
      wrap.innerHTML = "";
      renderStoriesTab();
    } catch (err) {
      A.toast(err.message, "error");
      saveBtn.disabled = false; saveBtn.textContent = "حفظ";
    }
  });
}

async function deleteStory(id) {
  const story = A.state.stories.find(s => s.id === id);
  if (!story || !confirm(`حذف "${story.title}"؟ لا يمكن التراجع.`)) return;
  A.state.stories = A.state.stories.filter(s => s.id !== id);
  try {
    await A.saveStories(`حذف قصة: ${story.title}`);
    A.toast("تم الحذف");
    renderStoriesTab();
  } catch (e) { A.toast(e.message, "error"); }
}

async function toggleStoryField(id, field) {
  const story = A.state.stories.find(s => s.id === id);
  if (!story) return;
  if (field === "status") story.status = story.status === "published" ? "draft" : "published";
  else story[field] = !story[field];
  try {
    await A.saveStories(`تحديث ${field} للقصة: ${story.title}`);
    renderStoriesTab();
  } catch (e) { A.toast(e.message, "error"); }
}

// ---------- تبويب التصنيفات ----------

function renderCategoriesTab() {
  const content = document.getElementById("tabContent");
  const countPublished = (catId) => A.state.stories.filter(s => s.category_id === catId && s.status === "published").length;

  content.innerHTML = `
    <h1 class="admin-page-title">التصنيفات</h1>
    <div class="admin-panel">
      <h2>إضافة تصنيف جديد</h2>
      <form id="newCategoryForm" class="inline-form">
        <input type="text" name="name" placeholder="اسم التصنيف" required>
        <input type="text" name="description" placeholder="وصف (اختياري)">
        <button type="submit" class="btn-primary">إضافة</button>
      </form>
    </div>
    <div class="category-rows">
      <div class="category-row category-row-head"><span>الاسم</span><span>الرابط</span><span>القصص المنشورة</span><span>إجراءات</span></div>
      ${A.state.categories.map(c => `
        <div class="category-row" data-id="${c.id}">
          <input type="text" class="cat-name-input" value="${A.escapeHtml(c.name)}">
          <span class="muted">/${A.escapeHtml(c.slug)}</span>
          <span>${countPublished(c.id)}</span>
          <span class="row-actions">
            <button class="btn-secondary sm cat-save" data-id="${c.id}">حفظ</button>
            <button class="link-danger cat-delete" data-id="${c.id}">حذف</button>
          </span>
        </div>`).join("") || `<p class="muted">لا توجد تصنيفات بعد.</p>`}
    </div>
  `;

  document.getElementById("newCategoryForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = e.target.name.value.trim();
    const description = e.target.description.value.trim();
    if (!name) return;
    A.state.categories.push({
      id: A.nextId(A.state.categories), name,
      slug: A.uniqueSlug(A.state.categories, A.slugify(name)),
      description, sort_order: A.state.categories.length,
    });
    try {
      await A.saveCategories(`إضافة تصنيف: ${name}`);
      A.toast("تمت الإضافة");
      renderCategoriesTab();
    } catch (err) { A.toast(err.message, "error"); }
  });

  content.querySelectorAll(".cat-save").forEach(btn => btn.addEventListener("click", async () => {
    const row = btn.closest(".category-row");
    const cat = A.state.categories.find(c => c.id === Number(btn.dataset.id));
    const newName = row.querySelector(".cat-name-input").value.trim();
    if (!newName) return;
    cat.name = newName;
    cat.slug = A.uniqueSlug(A.state.categories, A.slugify(newName), cat.id);
    try {
      await A.saveCategories(`تعديل تصنيف: ${newName}`);
      A.toast("تم الحفظ");
      renderCategoriesTab();
    } catch (err) { A.toast(err.message, "error"); }
  }));

  content.querySelectorAll(".cat-delete").forEach(btn => btn.addEventListener("click", async () => {
    const cat = A.state.categories.find(c => c.id === Number(btn.dataset.id));
    if (!confirm(`حذف تصنيف "${cat.name}"؟ ستصبح قصصه بلا تصنيف.`)) return;
    A.state.categories = A.state.categories.filter(c => c.id !== cat.id);
    A.state.stories.forEach(s => { if (s.category_id === cat.id) s.category_id = null; });
    try {
      await A.saveCategories(`حذف تصنيف: ${cat.name}`);
      await A.saveStories(`تحديث القصص بعد حذف تصنيف: ${cat.name}`);
      A.toast("تم الحذف");
      renderCategoriesTab();
    } catch (err) { A.toast(err.message, "error"); }
  }));
}

// ---------- تبويب الإعدادات ----------

function renderSettingsTab() {
  const s = A.state.settings;
  const content = document.getElementById("tabContent");
  content.innerHTML = `
    <h1 class="admin-page-title">إعدادات الموقع</h1>
    <form id="settingsForm" class="admin-form">
      <div class="form-grid">
        <div class="form-col">
          <label>اسم الموقع<input type="text" name="site_name" value="${A.escapeHtml(s.site_name || "")}"></label>
          <label>الشعار النصي<input type="text" name="site_tagline" value="${A.escapeHtml(s.site_tagline || "")}"></label>
          <label>وصف الموقع<textarea name="site_description" rows="3">${A.escapeHtml(s.site_description || "")}</textarea></label>
          <label>نص زر البدء<input type="text" name="hero_cta_text" value="${A.escapeHtml(s.hero_cta_text || "")}"></label>
          <label>نص "عن الموقع"<textarea name="about_text" rows="4">${A.escapeHtml(s.about_text || "")}</textarea></label>
          <label>نص التذييل<input type="text" name="footer_text" value="${A.escapeHtml(s.footer_text || "")}"></label>
        </div>
        <div class="form-col">
          <label>شعار الموقع (لوجو)<input type="file" name="logo" accept=".jpg,.jpeg,.png,.webp"></label>
          ${s.logo_path ? `<img class="preview-thumb" src="../${s.logo_path}">` : ""}
          <hr class="soft-divider">
          <h3>SEO</h3>
          <label>Meta Title<input type="text" name="meta_title" value="${A.escapeHtml(s.meta_title || "")}"></label>
          <label>Meta Description<textarea name="meta_description" rows="3">${A.escapeHtml(s.meta_description || "")}</textarea></label>
        </div>
      </div>
      <div class="form-actions"><button type="submit" class="btn-primary" id="settingsSaveBtn">حفظ</button></div>
    </form>
  `;

  document.getElementById("settingsForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const btn = document.getElementById("settingsSaveBtn");
    btn.disabled = true; btn.textContent = "جارٍ الحفظ…";
    try {
      if (form.logo.files[0]) {
        s.logo_path = await A.uploadFile(form.logo.files[0], "cover");
      }
      s.site_name = form.site_name.value;
      s.site_tagline = form.site_tagline.value;
      s.site_description = form.site_description.value;
      s.hero_cta_text = form.hero_cta_text.value;
      s.about_text = form.about_text.value;
      s.footer_text = form.footer_text.value;
      s.meta_title = form.meta_title.value;
      s.meta_description = form.meta_description.value;
      await A.saveSettings("تحديث إعدادات الموقع");
      A.toast("تم حفظ الإعدادات ✅");
      renderSettingsTab();
    } catch (err) {
      A.toast(err.message, "error");
      btn.disabled = false; btn.textContent = "حفظ";
    }
  });
}

// ---------- تبويب المساعدة ----------

function renderHelpTab() {
  document.getElementById("tabContent").innerHTML = `
    <h1 class="admin-page-title">مساعدة</h1>
    <div class="admin-panel">
      <h2>كيف تعمل هذه اللوحة؟</h2>
      <p class="muted">كل زر "حفظ" هنا يقوم بعمل Commit مباشر لملفات JSON داخل مستودع
      GitHub الخاص بك. موقعك المنشور على GitHub Pages يقرأ نفس الملفات، لذلك أي تعديل
      يظهر للزوار خلال دقيقة أو أقل دون الحاجة لأي إعادة نشر يدوي.</p>
    </div>
    <div class="admin-panel">
      <h2>ملاحظات مهمة</h2>
      <p class="muted">• عداد الاستماع هنا تراكمي على مستوى الموقع (يُحدَّث فقط من لوحة
      التحكم يدويًا حاليًا لأن الموقع ثابت بلا خادم مركزي يجمع زيارات كل الزوار تلقائيًا).<br>
      • حجم الملف الصوتي محدود بـ 25MB لأن الرفع يمر عبر متصفحك مباشرة إلى GitHub.<br>
      • أي شخص يملك رابط هذه الصفحة ومفتاح GitHub (Token) الخاص بك يقدر يعدّل الموقع،
      فحافظي عليه سريًا ولا تشاركيه.</p>
    </div>
  `;
}
