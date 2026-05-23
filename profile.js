/**
 * ══════════════════════════════════════════════════════════════════
 *  Memory Vault — profile.js  v2.1
 *  Changes from v1:
 *    ✅ Image upload replaced with Direct URL input + live preview
 *    ✅ Video system adds Thumbnail URL field (stored + displayed)
 *    ✅ Per-item Privacy toggle (isPublic field) for images & videos
 *    ✅ Admin can toggle/delete individual media items inline
 *    ✅ Video thumbnail click opens full-screen player modal
 *    ✅ Notes tab: load / save rich text to Firestore
 *    ✅ 7 randomised profile layout themes (set on <body>)
 *    ✅ Supports nested contacts via ?containerId= URL param
 *    ✅ No Firebase Storage dependency at all
 * ══════════════════════════════════════════════════════════════════
 */

/* ─── Section 1: Firebase Imports ──────────────────────────────── */
import { initializeApp }        from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signOut,
         onAuthStateChanged }   from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore,
         doc, getDoc, setDoc,
         collection, addDoc, getDocs,
         deleteDoc, updateDoc,
         query, orderBy,
         serverTimestamp }      from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/* ─── 🔑 Firebase Config — Replace with your project values ──────── */
const firebaseConfig = {
  apiKey:            "AIzaSyCRmbz_f1iVnD36iz3JJvLziA1Lr1Jp-nI",           // ← Replace
  authDomain:        "my-personal-cloud-f2c31.firebaseapp.com",       // ← Replace
  projectId:         "my-personal-cloud-f2c31",        // ← Replace
  storageBucket:     "my-personal-cloud-f2c31.firebasestorage.app",    // ← Replace
  messagingSenderId: "1069957164590", // ← Replace
  appId:             "1:1069957164590:web:51221429318bc4260bb9bf"
};

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ─── Section 2: URL Router ──────────────────────────────────────── */
const params      = new URLSearchParams(window.location.search);
const contactId   = params.get('id');
const containerId = params.get('containerId'); // set when contact lives in a container

if (!contactId) window.location.replace('index.html');

/* ─── Section 3: Firestore Path Helper ──────────────────────────── */
/**
 * Returns the Firestore DocumentReference for the contact.
 * If containerId is present → containers/{cid}/contacts/{id}
 * Otherwise                  → contacts/{id}
 */
function contactDocRef() {
  return containerId
    ? doc(db, 'containers', containerId, 'contacts', contactId)
    : doc(db, 'contacts', contactId);
}
function mediaCollRef(type) {
  return containerId
    ? collection(db, 'containers', containerId, 'contacts', contactId, type)
    : collection(db, 'contacts', contactId, type);
}
function mediaDocRef(type, docId) {
  return containerId
    ? doc(db, 'containers', containerId, 'contacts', contactId, type, docId)
    : doc(db, 'contacts', contactId, type, docId);
}
function notesDocRef() {
  return containerId
    ? doc(db, 'containers', containerId, 'contacts', contactId, 'meta', 'notes')
    : doc(db, 'contacts', contactId, 'meta', 'notes');
}

/* ─── Section 4: DOM References ─────────────────────────────────── */
const pageLoader       = document.getElementById('page-loader');
const profileAvatar    = document.getElementById('profile-avatar');
const profileName      = document.getElementById('profile-name');
const profileBadge     = document.getElementById('profile-badge');
const profileBio       = document.getElementById('profile-bio');
const profileBirthday  = document.getElementById('profile-birthday');
const profileLink      = document.getElementById('profile-link');
const profilePrivBadge = document.getElementById('profile-privacy-badge');
const profileNotFound  = document.getElementById('profile-not-found');
const imageGallery     = document.getElementById('image-gallery');
const videoGrid        = document.getElementById('video-grid');
const notesDisplay     = document.getElementById('notes-display');
const uploadPanel      = document.getElementById('upload-panel');
const authBadge        = document.getElementById('auth-badge');
const authBadgeLabel   = document.getElementById('auth-badge-label');
const logoutBtn        = document.getElementById('btn-logout');

// Contact card tab
const contactCardAvatar = document.getElementById('contact-card-avatar');
const contactCardName   = document.getElementById('contact-card-name');
const contactCardBio    = document.getElementById('contact-card-bio');
const contactCardLink   = document.getElementById('contact-card-link');

// Back link (update for nested view)
const backLink      = document.getElementById('back-link');
const backLinkLabel = document.getElementById('back-link-label');
const btnBackHero   = document.getElementById('btn-back-hero');

// Image admin inputs
const imageUrlInput       = document.getElementById('image-url-input');
const imageCaptionInput   = document.getElementById('image-caption-input');
const imageUrlPreview     = document.getElementById('image-url-preview');
const imagePrivacyToggle  = document.getElementById('image-privacy-toggle');
const imagePrivacyText    = document.getElementById('image-privacy-text');
const btnPreviewImage     = document.getElementById('btn-preview-image');
const btnAddImage         = document.getElementById('btn-add-image');

// Video admin inputs
const videoLinkType       = document.getElementById('video-link-type');
const videoLinkInput      = document.getElementById('video-link-input');
const videoThumbInput     = document.getElementById('video-thumb-input');
const videoThumbPreview   = document.getElementById('video-thumb-preview');
const videoLabelInput     = document.getElementById('video-label-input');
const videoPrivacyToggle  = document.getElementById('video-privacy-toggle');
const videoPrivacyText    = document.getElementById('video-privacy-text');
const btnAddVideo         = document.getElementById('btn-add-video');

// Notes inputs
const notesInput    = document.getElementById('notes-input');
const btnSaveNotes  = document.getElementById('btn-save-notes');

// Video player modal
const videoPlayerModal = document.getElementById('video-player-modal');
const videoPlayerTitle = document.getElementById('video-player-title');
const videoPlayerBody  = document.getElementById('video-player-body');
const videoPlayerClose = document.getElementById('video-player-close');

/* ─── Section 5: Platform Map ───────────────────────────────────── */
const PLATFORM_MAP = {
  facebook:  { label: 'Facebook',  icon: 'fa-brands fa-facebook-f' },
  instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram'  },
  github:    { label: 'GitHub',    icon: 'fa-brands fa-github'     },
  whatsapp:  { label: 'WhatsApp',  icon: 'fa-brands fa-whatsapp'   },
};

/* ─── Section 6: Randomised Profile Themes ──────────────────────── */
const THEMES = [
  'neon-cyber',
  'aurora-borealis',
  'ember-glow',
  'deep-ocean',
  'rose-quartz',
  'obsidian-gold',
  'arctic-ice',
];

/**
 * Assigns a deterministic-but-visually-random theme to <body>.
 * Uses the contactId string to pick consistently (same contact = same theme).
 * Falls back to pure random if no contactId.
 */
function applyProfileTheme() {
  let seed = 0;
  if (contactId) {
    for (let i = 0; i < contactId.length; i++) seed += contactId.charCodeAt(i);
  } else {
    seed = Math.floor(Math.random() * THEMES.length * 100);
  }
  const theme = THEMES[seed % THEMES.length];
  document.body.setAttribute('data-theme', theme);
}
applyProfileTheme();

/* ─── Section 7: Auth State ─────────────────────────────────────── */
let isAdmin = false;

onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = true;
    authBadge.classList.add('admin');
    authBadgeLabel.textContent = user.email.split('@')[0];
    logoutBtn.classList.remove('hidden');
    uploadPanel.classList.remove('hidden');
  } else {
    isAdmin = false;
    authBadge.classList.remove('admin');
    authBadgeLabel.textContent = 'Visitor';
    logoutBtn.classList.add('hidden');
    uploadPanel.classList.add('hidden');
  }
});

logoutBtn?.addEventListener('click', async () => {
  try { await signOut(auth); showToast('info', 'Signed Out', 'Browsing in visitor mode.'); }
  catch { showToast('error', 'Error', 'Could not sign out.'); }
});

/* ─── Section 8: Load Profile ───────────────────────────────────── */
async function loadProfile() {
  try {
    // Update back link for nested contacts
    if (containerId) {
      const backUrl = `index.html?container=${containerId}`;
      backLink.href = backUrl;
      btnBackHero.href = backUrl;
      backLinkLabel.textContent = 'Back to Collection';
    }

    const docSnap = await getDoc(contactDocRef());
    if (!docSnap.exists()) {
      profileNotFound.classList.remove('hidden');
      document.querySelector('.profile-hero')?.classList.add('hidden');
      return;
    }

    const data         = docSnap.data();
    const platformData = PLATFORM_MAP[data.platform] || { label: data.platform || 'Unknown', icon: 'fa-solid fa-user' };

    // Hero section
    profileAvatar.innerHTML        = `<i class="${platformData.icon}" aria-hidden="true"></i>`;
    profileAvatar.dataset.platform = data.platform;
    profileName.textContent        = data.name     || 'Unnamed Contact';
    profileBio.textContent         = data.bio      || 'No biography provided.';
    profileBirthday.textContent    = data.birthday ? formatDate(data.birthday) : 'Not specified';
    profileBadge.textContent       = platformData.label;
    profileBadge.className         = `platform-badge ${data.platform}`;

    // Privacy badge on hero
    if (data.isPublic === false) {
      profilePrivBadge.classList.remove('hidden');
    }

    // External link
    if (data.profileUrl) {
      profileLink.href = sanitizeUrl(data.profileUrl);
      profileLink.classList.remove('hidden');
    }

    // Contact card tab
    contactCardAvatar.innerHTML     = `<i class="${platformData.icon}" style="color:var(--accent-primary);"></i>`;
    contactCardName.textContent     = data.name || 'Unnamed';
    contactCardBio.textContent      = data.bio  || '';
    contactCardLink.href            = sanitizeUrl(data.profileUrl || '#');

    document.title = `${data.name || 'Profile'} — Memory Vault`;

    // Load all sub-collections in parallel
    await Promise.all([loadImages(), loadVideos(), loadNotes()]);

  } catch (err) {
    console.error('[Vault] loadProfile error:', err);
    showToast('error', 'Load Error', 'Could not load profile data.');
  } finally {
    setTimeout(() => pageLoader.classList.add('hidden'), 400);
  }
}

/* ─── Section 9: Load Images ────────────────────────────────────── */
async function loadImages() {
  imageGallery.innerHTML = '<p class="text-muted text-sm" style="padding:var(--sp-4)">Loading photos…</p>';
  try {
    const q        = query(mediaCollRef('images'), orderBy('uploadedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      imageGallery.innerHTML = getEmptyMediaHTML('fa-solid fa-images', 'No photos yet.');
      return;
    }

    imageGallery.innerHTML = '';
    const allDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Visitors only see public items
    const visible = isAdmin ? allDocs : allDocs.filter((d) => d.isPublic !== false);

    if (visible.length === 0) {
      imageGallery.innerHTML = getEmptyMediaHTML('fa-solid fa-lock', 'No public photos available.');
      return;
    }

    const urls = visible.map((d) => d.url);
    initLightbox(urls);

    visible.forEach((imgData, index) => {
      imageGallery.appendChild(buildGalleryItem(imgData, index, urls));
    });

  } catch (err) {
    console.error('[Vault] loadImages error:', err);
    imageGallery.innerHTML = '<p class="text-muted text-sm" style="padding:var(--sp-4)">Failed to load photos.</p>';
  }
}

/* ─── Section 10: Build Gallery Item ────────────────────────────── */
/**
 * Creates a gallery tile.
 * @param {{id,url,caption,isPublic}} imgData  — Firestore document data + id
 * @param {number} index                        — Index for lightbox
 * @param {string[]} urls                       — Full URL array for lightbox navigation
 */
function buildGalleryItem(imgData, index, urls) {
  const { id, url, caption, isPublic } = imgData;
  const isPublicItem = isPublic !== false;

  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.id = id;
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-label', `View photo ${index + 1}${caption ? ': ' + caption : ''}`);
  item.style.position = 'relative';

  // Privacy badge (always show to admin; public badge for admin, private for visitor when admin shows private)
  const badgeHTML = isAdmin
    ? (isPublicItem
        ? `<span class="media-public-badge"><i class="fa-solid fa-globe"></i>Public</span>`
        : `<span class="media-private-badge"><i class="fa-solid fa-lock"></i>Private</span>`)
    : ''; // visitors: no badge (they can't see private ones anyway)

  // Admin inline controls bar (overlay at bottom)
  const adminBarHTML = isAdmin ? `
    <div class="item-admin-bar" role="group" aria-label="Image controls">
      <label class="vis-toggle" title="${isPublicItem ? 'Set Private' : 'Set Public'}">
        <input type="checkbox" class="vis-chk" ${isPublicItem ? 'checked' : ''} />
        <span class="vis-track"></span>
      </label>
      <button class="item-del-btn" type="button" aria-label="Delete this photo">
        <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
      </button>
    </div>` : '';

  item.innerHTML = `
    ${badgeHTML}
    <img
      src="${escapeHTML(url)}"
      alt="${escapeHTML(caption || `Photo ${index + 1}`)}"
      loading="lazy"
      decoding="async"
      onerror="this.parentElement.style.opacity='.4'"
    />
    <div class="gallery-item-overlay" aria-hidden="true">
      <i class="fa-solid fa-magnifying-glass-plus"></i>
    </div>
    ${adminBarHTML}
  `;

  // Open lightbox on click (not on admin controls)
  item.addEventListener('click', (e) => {
    if (e.target.closest('.item-admin-bar')) return;
    openLightbox(index, urls);
  });
  item.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.item-admin-bar')) {
      e.preventDefault();
      openLightbox(index, urls);
    }
  });

  // Admin: visibility toggle
  if (isAdmin) {
    const checkbox = item.querySelector('.vis-chk');
    checkbox?.addEventListener('change', async (e) => {
      e.stopPropagation();
      const newVal = checkbox.checked;
      try {
        await updateDoc(mediaDocRef('images', id), { isPublic: newVal });
        // Update badge
        const badge = item.querySelector('.media-public-badge, .media-private-badge');
        if (badge) {
          badge.className = newVal ? 'media-public-badge' : 'media-private-badge';
          badge.innerHTML = newVal
            ? '<i class="fa-solid fa-globe"></i>Public'
            : '<i class="fa-solid fa-lock"></i>Private';
        }
        showToast('info', 'Updated', `Photo is now ${newVal ? 'Public' : 'Private'}.`);
      } catch (err) {
        console.error(err);
        showToast('error', 'Failed', 'Could not update privacy.');
        checkbox.checked = !newVal;
      }
    });

    // Admin: delete
    const delBtn = item.querySelector('.item-del-btn');
    delBtn?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this photo? This cannot be undone.')) return;
      try {
        await deleteDoc(mediaDocRef('images', id));
        item.style.transition = 'all .3s ease';
        item.style.transform  = 'scale(.85)';
        item.style.opacity    = '0';
        setTimeout(() => { item.remove(); }, 300);
        showToast('success', 'Deleted', 'Photo removed from gallery.');
      } catch (err) {
        console.error(err);
        showToast('error', 'Failed', 'Could not delete the photo.');
      }
    });
  }

  return item;
}

/* ─── Section 11: Load Videos ───────────────────────────────────── */
async function loadVideos() {
  videoGrid.innerHTML = '<p class="text-muted text-sm" style="padding:var(--sp-4)">Loading videos…</p>';
  try {
    const q        = query(mediaCollRef('videos'), orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      videoGrid.innerHTML = getEmptyMediaHTML('fa-solid fa-film', 'No videos yet.');
      return;
    }

    videoGrid.innerHTML = '';
    const allDocs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const visible = isAdmin ? allDocs : allDocs.filter((d) => d.isPublic !== false);

    if (visible.length === 0) {
      videoGrid.innerHTML = getEmptyMediaHTML('fa-solid fa-lock', 'No public videos available.');
      return;
    }

    visible.forEach((vData) => videoGrid.appendChild(buildVideoCard(vData)));

  } catch (err) {
    console.error('[Vault] loadVideos error:', err);
    videoGrid.innerHTML = '<p class="text-muted text-sm" style="padding:var(--sp-4)">Failed to load videos.</p>';
  }
}

/* ─── Section 12: Build Video Card ──────────────────────────────── */
/**
 * Builds a video card using the custom thumbnail as a clickable preview.
 * Clicking the thumbnail opens the full-screen video player modal.
 *
 * Firestore document fields stored:
 *   embedId   — Drive File ID or direct URL
 *   type      — 'drive' | 'url'
 *   label     — optional title string
 *   thumbUrl  — optional custom thumbnail URL  ← NEW
 *   isPublic  — boolean                        ← NEW
 *   addedAt   — serverTimestamp
 */
function buildVideoCard(vData) {
  const { id, embedId, type, label, thumbUrl, isPublic } = vData;
  const isPublicItem = isPublic !== false;

  const card = document.createElement('div');
  card.className = 'video-card';
  card.dataset.id = id;

  // Build the embed URL used inside the player modal
  const embedUrl = buildEmbedUrl(embedId, type);

  // Thumbnail: custom URL, or a drive thumbnail fallback, or icon placeholder
  let thumbContent;
  if (thumbUrl) {
    thumbContent = `
      <img
        src="${escapeHTML(thumbUrl)}"
        alt="Thumbnail for ${escapeHTML(label || 'video')}"
        loading="lazy"
        onerror="this.style.display='none';this.nextElementSibling.style.display='grid';"
      />
      <div style="display:none;place-items:center;width:100%;height:100%;background:var(--clr-surface-2);">
        <i class="fa-solid fa-play" style="font-size:2rem;color:var(--accent-primary);"></i>
      </div>`;
  } else {
    thumbContent = `
      <div style="display:grid;place-items:center;width:100%;height:100%;background:var(--clr-surface-2);">
        <i class="fa-solid fa-play" style="font-size:2rem;color:var(--accent-primary);"></i>
      </div>`;
  }

  // Privacy badge for admin
  const badgeHTML = isAdmin
    ? (isPublicItem
        ? `<span class="media-public-badge"><i class="fa-solid fa-globe"></i>Public</span>`
        : `<span class="media-private-badge"><i class="fa-solid fa-lock"></i>Private</span>`)
    : '';

  // Admin bar (below card)
  const adminBarHTML = isAdmin ? `
    <div class="video-admin-bar" role="group" aria-label="Video controls">
      <label class="vis-toggle" title="${isPublicItem ? 'Set Private' : 'Set Public'}" style="display:flex;align-items:center;gap:.4rem;">
        <input type="checkbox" class="vis-chk" ${isPublicItem ? 'checked' : ''} />
        <span class="vis-track"></span>
        <span style="font-size:.72rem;color:#64748b;">${isPublicItem ? 'Public' : 'Private'}</span>
      </label>
      <button class="btn btn-danger btn-sm item-del-btn" type="button" aria-label="Delete this video">
        <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        Delete
      </button>
    </div>` : '';

  card.innerHTML = `
    <div class="video-thumb-wrap" role="button" tabindex="0" aria-label="Play: ${escapeHTML(label || 'video')}">
      ${badgeHTML}
      ${thumbContent}
      <div class="video-play-overlay" aria-hidden="true">
        <div class="play-circle"><i class="fa-solid fa-play"></i></div>
      </div>
    </div>
    <div class="video-meta">
      <span class="video-label">
        <i class="${type === 'drive' ? 'fa-brands fa-google-drive' : 'fa-solid fa-play'}" aria-hidden="true"></i>
        ${escapeHTML(label || (type === 'drive' ? 'Drive Video' : 'Video'))}
      </span>
    </div>
    ${adminBarHTML}
  `;

  // Thumbnail click → open player modal
  const thumbWrap = card.querySelector('.video-thumb-wrap');
  const openPlayer = () => openVideoModal(embedUrl, label, type, embedId);
  thumbWrap.addEventListener('click', (e) => {
    if (e.target.closest('.media-public-badge, .media-private-badge')) return;
    openPlayer();
  });
  thumbWrap.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayer(); }
  });

  // Admin: visibility toggle
  if (isAdmin) {
    const checkbox  = card.querySelector('.vis-chk');
    const visLabel  = checkbox?.parentElement?.querySelector('span:last-child');
    checkbox?.addEventListener('change', async (e) => {
      e.stopPropagation();
      const newVal = checkbox.checked;
      try {
        await updateDoc(mediaDocRef('videos', id), { isPublic: newVal });
        if (visLabel) visLabel.textContent = newVal ? 'Public' : 'Private';
        const badge = card.querySelector('.media-public-badge, .media-private-badge');
        if (badge) {
          badge.className = newVal ? 'media-public-badge' : 'media-private-badge';
          badge.innerHTML = newVal
            ? '<i class="fa-solid fa-globe"></i>Public'
            : '<i class="fa-solid fa-lock"></i>Private';
        }
        showToast('info', 'Updated', `Video is now ${newVal ? 'Public' : 'Private'}.`);
      } catch (err) {
        console.error(err);
        showToast('error', 'Failed', 'Could not update visibility.');
        checkbox.checked = !newVal;
      }
    });

    // Admin: delete
    card.querySelector('.item-del-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Delete this video? This cannot be undone.')) return;
      try {
        await deleteDoc(mediaDocRef('videos', id));
        card.style.transition = 'all .3s ease';
        card.style.transform  = 'scale(.85)';
        card.style.opacity    = '0';
        setTimeout(() => card.remove(), 300);
        showToast('success', 'Deleted', 'Video removed.');
      } catch (err) {
        console.error(err);
        showToast('error', 'Failed', 'Could not delete the video.');
      }
    });
  }

  return card;
}

/* ─── Section 13: Video Player Modal ────────────────────────────── */
/**
 * Opens the full-screen video modal and injects the correct player.
 * @param {string} embedUrl — Resolved embed/src URL
 * @param {string} label    — Display title
 * @param {string} type     — 'drive' | 'url'
 * @param {string} raw      — Raw input (for direct video detection)
 */
function openVideoModal(embedUrl, label, type, raw) {
  videoPlayerTitle.textContent = label || (type === 'drive' ? 'Drive Video' : 'Video');
  videoPlayerBody.innerHTML    = '';

  const isDirectVideo = type === 'url' && /\.(mp4|webm|ogg)(\?.*)?$/i.test(raw);

  if (isDirectVideo) {
    const vid = document.createElement('video');
    vid.controls  = true;
    vid.autoplay  = true;
    vid.preload   = 'auto';
    vid.style.cssText = 'width:100%;height:100%;background:#000;';
    const src = document.createElement('source');
    src.src  = escapeHTML(raw);
    vid.appendChild(src);
    videoPlayerBody.appendChild(vid);
  } else {
    const iframe = document.createElement('iframe');
    iframe.src               = embedUrl;
    iframe.allow             = 'autoplay; fullscreen; picture-in-picture; accelerometer; encrypted-media; gyroscope';
    iframe.allowFullscreen   = true;
    iframe.style.cssText     = 'width:100%;height:100%;border:none;';
    iframe.title             = escapeHTML(label || 'Video');
    videoPlayerBody.appendChild(iframe);
  }

  videoPlayerModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  videoPlayerClose.focus();
}

function closeVideoModal() {
  videoPlayerModal.classList.remove('active');
  document.body.style.overflow = '';
  // Clear iframe/video to stop playback
  setTimeout(() => { videoPlayerBody.innerHTML = ''; }, 400);
}

videoPlayerClose.addEventListener('click', closeVideoModal);
videoPlayerModal.addEventListener('click', (e) => {
  if (e.target === videoPlayerModal) closeVideoModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && videoPlayerModal.classList.contains('active')) closeVideoModal();
});

/* ─── Section 14: Embed URL Builder ─────────────────────────────── */
/**
 * Converts raw input (Drive ID, direct URL, etc.) into a usable embed URL.
 */
function buildEmbedUrl(embedId, type) {
  if (type === 'drive') {
    // Clean any full URL down to just the file ID
    const match = embedId.match(/\/d\/([a-zA-Z0-9_-]+)/);
    const id    = match ? match[1] : embedId.trim();
    return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
  }
  // type === 'url' — return as-is (direct video handled separately)
  return embedId;
}

/* ─── Section 15: Load Notes ────────────────────────────────────── */
async function loadNotes() {
  try {
    const snap = await getDoc(notesDocRef());
    const text = snap.exists() ? (snap.data().text || '') : '';
    notesDisplay.textContent = text;
    if (notesInput) notesInput.value = text;
  } catch (err) {
    console.error('[Vault] loadNotes error:', err);
  }
}

/* ─── Section 16: Save Notes ────────────────────────────────────── */
btnSaveNotes?.addEventListener('click', async () => {
  const text = notesInput.value.trim();
  setButtonLoading(btnSaveNotes, true);
  try {
    await setDoc(notesDocRef(), { text, updatedAt: serverTimestamp() }, { merge: true });
    notesDisplay.textContent = text;
    showToast('success', 'Notes Saved', 'Your notes have been updated.');
  } catch (err) {
    console.error('[Vault] saveNotes error:', err);
    showToast('error', 'Save Failed', 'Could not save notes. Check Firestore rules.');
  } finally {
    setButtonLoading(btnSaveNotes, false, '<i class="fa-solid fa-floppy-disk"></i> Save Notes');
  }
});

/* ─── Section 17: Image URL Preview ─────────────────────────────── */
btnPreviewImage?.addEventListener('click', () => previewImageUrl(imageUrlInput.value.trim(), imageUrlPreview));
imageUrlInput?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') previewImageUrl(imageUrlInput.value.trim(), imageUrlPreview);
});

function previewImageUrl(url, container) {
  if (!url) return;
  container.innerHTML = '';
  container.classList.add('visible');
  const img = document.createElement('img');
  img.src  = url;
  img.alt  = 'Preview';
  img.style.cssText = 'width:100%;max-height:160px;object-fit:cover;display:block;';
  img.onerror = () => {
    container.innerHTML = `<div class="url-preview-error"><i class="fa-solid fa-triangle-exclamation"></i> Could not load image. Check the URL is publicly accessible.</div>`;
  };
  container.appendChild(img);
}

/* ─── Section 18: Video Thumbnail Preview ───────────────────────── */
videoThumbInput?.addEventListener('input', debounce(() => {
  const url = videoThumbInput.value.trim();
  if (!url) { videoThumbPreview.classList.remove('visible'); videoThumbPreview.innerHTML = ''; return; }
  previewImageUrl(url, videoThumbPreview);
}, 600));

/* ─── Section 19: Privacy Toggle Live Label ─────────────────────── */
function wirePrivacyLabel(toggle, label) {
  if (!toggle || !label) return;
  toggle.addEventListener('change', () => {
    const isPublic = toggle.checked;
    label.textContent  = isPublic ? 'Public' : 'Private';
    label.className    = `privacy-status-text ${isPublic ? 'public' : 'private'}`;
  });
}
wirePrivacyLabel(imagePrivacyToggle, imagePrivacyText);
wirePrivacyLabel(videoPrivacyToggle, videoPrivacyText);

/* ─── Section 20: Admin — Add Image via URL ─────────────────────── */
/**
 * Saves a new image document to Firestore sub-collection.
 * Firestore path: contacts/{contactId}/images/{autoId}
 * Fields: { url, caption, isPublic, uploadedAt }
 *
 * NO Firebase Storage is used — the URL string is saved directly.
 */
btnAddImage?.addEventListener('click', async () => {
  const url     = imageUrlInput.value.trim();
  const caption = imageCaptionInput.value.trim();
  const isPublic = imagePrivacyToggle.checked;

  if (!url) {
    showToast('error', 'Missing URL', 'Please paste an image URL first.');
    imageUrlInput.classList.add('is-error');
    imageUrlInput.focus();
    return;
  }
  imageUrlInput.classList.remove('is-error');

  setButtonLoading(btnAddImage, true);
  try {
    await addDoc(mediaCollRef('images'), {
      url,
      caption:    caption || '',
      isPublic,
      uploadedAt: serverTimestamp(),
    });

    // Reset inputs
    imageUrlInput.value        = '';
    imageCaptionInput.value    = '';
    imagePrivacyToggle.checked = true;
    imagePrivacyText.textContent = 'Public';
    imagePrivacyText.className   = 'privacy-status-text public';
    imageUrlPreview.classList.remove('visible');
    imageUrlPreview.innerHTML  = '';

    showToast('success', 'Image Added', 'Photo has been saved to the gallery.');
    await loadImages();
  } catch (err) {
    console.error('[Vault] addImage error:', err);
    showToast('error', 'Save Failed', 'Could not save image. Check Firestore rules.');
  } finally {
    setButtonLoading(btnAddImage, false, '<i class="fa-solid fa-plus"></i> Add Image');
  }
});

/* ─── Section 21: Admin — Add Video ─────────────────────────────── */
/**
 * Saves a new video document to Firestore sub-collection.
 * Fields: { embedId, type, label, thumbUrl, isPublic, addedAt }
 *
 * thumbUrl — optional custom thumbnail URL string (NOT stored in Storage)
 */
btnAddVideo?.addEventListener('click', async () => {
  const rawInput = videoLinkInput.value.trim();
  const type     = videoLinkType.value;
  const thumbUrl = videoThumbInput.value.trim();
  const label    = videoLabelInput.value.trim();
  const isPublic = videoPrivacyToggle.checked;

  if (!rawInput) {
    showToast('error', 'Missing Input', 'Please enter a Google Drive File ID or video URL.');
    videoLinkInput.classList.add('is-error');
    videoLinkInput.focus();
    return;
  }
  videoLinkInput.classList.remove('is-error');

  setButtonLoading(btnAddVideo, true);
  try {
    await addDoc(mediaCollRef('videos'), {
      embedId:  rawInput,
      type,
      label:    label || (type === 'drive' ? 'Drive Video' : 'Video'),
      thumbUrl: thumbUrl || '',  // ← saved as string; empty string = no custom thumb
      isPublic,
      addedAt:  serverTimestamp(),
    });

    // Reset inputs
    videoLinkInput.value        = '';
    videoThumbInput.value       = '';
    videoLabelInput.value       = '';
    videoPrivacyToggle.checked  = true;
    videoPrivacyText.textContent = 'Public';
    videoPrivacyText.className  = 'privacy-status-text public';
    videoThumbPreview.classList.remove('visible');
    videoThumbPreview.innerHTML = '';

    showToast('success', 'Video Added', 'Video has been saved to this profile.');
    await loadVideos();
  } catch (err) {
    console.error('[Vault] addVideo error:', err);
    showToast('error', 'Save Failed', 'Could not save video. Check Firestore rules.');
  } finally {
    setButtonLoading(btnAddVideo, false, '<i class="fa-solid fa-plus"></i> Add Video');
  }
});

/* ─── Section 22: Native Lightbox ───────────────────────────────── */
const lightboxEl    = document.getElementById('lightbox');
const lightboxImg   = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');
const lightboxPrev  = document.getElementById('lightbox-prev');
const lightboxNext  = document.getElementById('lightbox-next');

let _lbUrls  = [];
let _lbIndex = 0;

function initLightbox(urls) {
  _lbUrls = urls;
}

function openLightbox(index, urls) {
  if (urls) _lbUrls = urls;
  _lbIndex        = index;
  lightboxImg.src = _lbUrls[_lbIndex] || '';
  lightboxImg.alt = `Photo ${_lbIndex + 1} of ${_lbUrls.length}`;
  lightboxEl.classList.add('active');
  document.body.style.overflow = 'hidden';
  lightboxClose.focus();
}

function closeLightbox() {
  lightboxEl.classList.remove('active');
  document.body.style.overflow = '';
  setTimeout(() => { lightboxImg.src = ''; }, 500);
}

function navigateLightbox(dir) {
  if (_lbUrls.length < 2) return;
  _lbIndex = (_lbIndex + dir + _lbUrls.length) % _lbUrls.length;
  lightboxImg.style.opacity = '0';
  setTimeout(() => {
    lightboxImg.src = _lbUrls[_lbIndex];
    lightboxImg.alt = `Photo ${_lbIndex + 1} of ${_lbUrls.length}`;
    lightboxImg.style.transition = 'opacity .22s ease';
    lightboxImg.style.opacity    = '1';
  }, 140);
}

lightboxClose.addEventListener('click', closeLightbox);
lightboxPrev?.addEventListener('click', () => navigateLightbox(-1));
lightboxNext?.addEventListener('click', () => navigateLightbox(1));
lightboxEl.addEventListener('click', (e) => { if (e.target === lightboxEl) closeLightbox(); });
document.addEventListener('keydown', (e) => {
  if (!lightboxEl.classList.contains('active')) return;
  if (e.key === 'Escape')      closeLightbox();
  if (e.key === 'ArrowRight')  navigateLightbox(1);
  if (e.key === 'ArrowLeft')   navigateLightbox(-1);
});

/* ─── Section 23: Tab Navigation ───────────────────────────────── */
document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
  });
});

/* ─── Section 24: Header Scroll Effect ─────────────────────────── */
const siteHeader = document.querySelector('.site-header');
window.addEventListener('scroll', () => {
  siteHeader?.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/* ─── Section 25: Utility Functions ────────────────────────────── */
function escapeHTML(str) {
  const m = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };
  return String(str ?? '').replace(/[&<>"']/g, (c) => m[c]);
}

function formatDate(iso) {
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
      month:'long', day:'numeric', year:'numeric'
    });
  } catch { return iso; }
}

function sanitizeUrl(url) {
  try {
    const p = new URL(url);
    return ['http:', 'https:'].includes(p.protocol) ? url : '#';
  } catch { return '#'; }
}

function getEmptyMediaHTML(icon, text) {
  return `<div class="empty-state" style="padding:var(--sp-12) var(--sp-4);grid-column:1/-1;">
    <div class="empty-icon"><i class="${icon}" aria-hidden="true"></i></div>
    <p class="empty-title">${text}</p>
  </div>`;
}

function setButtonLoading(btn, loading, html = '') {
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Please wait…';
  } else {
    btn.innerHTML = html || btn.dataset.orig || btn.innerHTML;
  }
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const icons = {
    success:'fa-solid fa-circle-check',
    error:'fa-solid fa-circle-exclamation',
    info:'fa-solid fa-circle-info',
  };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-icon"><i class="${icons[type]}" aria-hidden="true"></i></div>
    <div class="toast-body">
      <p class="toast-title">${escapeHTML(title)}</p>
      <p class="toast-message">${escapeHTML(message)}</p>
    </div>
    <button style="margin-left:auto;border:none;background:none;color:#64748b;cursor:pointer;padding:.25rem;font-size:.9rem;" aria-label="Dismiss">
      <i class="fa-solid fa-xmark"></i>
    </button>`;
  const dismiss = () => { toast.classList.add('exit'); setTimeout(() => toast.remove(), 300); };
  toast.querySelector('button').addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

/* ─── Section 26: Firestore Security Rules (reference comment) ─── */
/*
  Minimum Firestore rules for this setup:

  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {

      // Public read on contacts; write only for authenticated admin
      match /contacts/{contactId} {
        allow read: if true;
        allow write: if request.auth != null;

        match /images/{imgId} {
          allow read: if true;
          allow write: if request.auth != null;
        }
        match /videos/{vidId} {
          allow read: if true;
          allow write: if request.auth != null;
        }
        match /meta/{doc} {
          allow read: if true;
          allow write: if request.auth != null;
        }
      }

      // Container-based contacts
      match /containers/{containerId} {
        allow read: if true;
        allow write: if request.auth != null;

        match /contacts/{contactId} {
          allow read: if true;
          allow write: if request.auth != null;

          match /images/{imgId} {
            allow read: if true;
            allow write: if request.auth != null;
          }
          match /videos/{vidId} {
            allow read: if true;
            allow write: if request.auth != null;
          }
          match /meta/{doc} {
            allow read: if true;
            allow write: if request.auth != null;
          }
        }
      }
    }
  }
*/

/* ─── Section 27: Init ──────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', loadProfile);
