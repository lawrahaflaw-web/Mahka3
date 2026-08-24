(function () {
  const audio = document.getElementById('audioEl');
  const player = document.getElementById('stickyPlayer');
  const els = {
    cover: document.getElementById('playerCover'),
    title: document.getElementById('playerTitle'),
    narrator: document.getElementById('playerNarrator'),
    toggle: document.getElementById('playerToggle'),
    back: document.getElementById('playerBack10'),
    fwd: document.getElementById('playerFwd10'),
    seek: document.getElementById('playerSeek'),
    current: document.getElementById('playerCurrent'),
    duration: document.getElementById('playerDuration'),
    speed: document.getElementById('playerSpeed'),
  };

  let currentStoryId = null;
  let listenTracked = false;
  let nextData = null;

  const easternDigits = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  function toEastern(str) {
    return String(str).replace(/[0-9]/g, d => easternDigits[d]);
  }
  function formatTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return toEastern(`${m}:${s.toString().padStart(2, '0')}`);
  }

  function loadStory(dataset) {
    currentStoryId = dataset.id;
    listenTracked = false;
    els.cover.src = dataset.cover || '';
    els.title.textContent = dataset.title || '';
    els.narrator.textContent = dataset.narrator || '';
    audio.src = dataset.audio || '';
    audio.playbackRate = parseFloat(els.speed.value || '1');

    nextData = dataset.nextAudio ? {
      id: dataset.nextId, audio: dataset.nextAudio, slug: dataset.nextSlug, title: dataset.nextTitle,
      cover: dataset.nextCover, narrator: dataset.nextNarrator,
    } : null;

    player.hidden = false;
    audio.play().catch(() => {});
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-play-story]');
    if (!el) return;
    e.preventDefault();
    loadStory(el.dataset);
  });

  els.toggle.addEventListener('click', () => {
    if (audio.paused) audio.play(); else audio.pause();
  });
  audio.addEventListener('play', () => { els.toggle.textContent = '⏸'; });
  audio.addEventListener('pause', () => { els.toggle.textContent = '▶'; });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    els.seek.value = (audio.currentTime / audio.duration) * 100;
    els.current.textContent = formatTime(audio.currentTime);
    els.duration.textContent = formatTime(audio.duration);

    // تسجيل استماع فعلي بعد تجاوز 5 ثوانٍ من التشغيل (وليس عند مجرد الفتح)
    if (!listenTracked && currentStoryId && audio.currentTime > 5) {
      listenTracked = true;
      fetch(`/api/stories/${currentStoryId}/listen`, { method: 'POST' }).catch(() => {});
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    els.duration.textContent = formatTime(audio.duration);
  });

  els.seek.addEventListener('input', () => {
    if (!audio.duration) return;
    audio.currentTime = (els.seek.value / 100) * audio.duration;
  });

  els.back.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 10); });
  els.fwd.addEventListener('click', () => { audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 10); });

  els.speed.addEventListener('change', () => {
    audio.playbackRate = parseFloat(els.speed.value);
  });

  audio.addEventListener('ended', () => {
    if (nextData && nextData.audio) {
      loadStory({
        id: nextData.id, cover: nextData.cover, title: nextData.title,
        narrator: nextData.narrator, audio: nextData.audio,
      });
      if (nextData.slug) {
        history.pushState({}, '', nextData.slug);
      }
    }
  });
})();
