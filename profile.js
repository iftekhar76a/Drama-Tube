/**
 * ============================================================
 *  Personal Cloud & Memory Vault — profile.js
 *  Profile page: data fetching, tabs, lightbox, media uploads
 *  Author  : Elite Full-Stack Developer
 *  Version : 1.0.0
 * ============================================================
 */

/* ────────────────────────────────────────────────────────────
   SECTION 1 · Firebase Imports & Initialisation
   ──────────────────────────────────────────────────────────── */

/**
 * 🔧 CUSTOMISE THIS BLOCK:
 *    Paste the same Firebase config object you used in main.js.
 *    Both pages share the same Firebase project.
 */
import { initializeApp }             from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth,
         onAuthStateChanged }        from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore,
         doc,
         getDoc,
         collection,
         addDoc,
         getDocs,
         query,
         orderBy,
         serverTimestamp }           from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getStorage,
         ref,
         uploadBytesResumable,
         getDownloadURL }            from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';

// ──────────────────────────────────────────────────────────
// 🔑 PASTE YOUR FIREBASE CONFIG HERE (same as main.js)
// ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "YOUR_API_KEY",             // ← Replace
  authDomain:        "YOUR_AUTH_DOMAIN",         // ← Replace
  projectId:         "YOUR_PROJECT_ID",          // ← Replace
  storageBucket:     "YOUR_STORAGE_BUCKET",      // ← Replace
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // ← Replace
  appId:             "YOUR_APP_ID"               // ← Replace
};

const app     = initializeApp(firebaseConfig);
const auth    = getAuth(app);
const db      = getFirestore(app);
const storage = getStorage(app);

/* ────────────────────────────────────────────────────────────
   SECTION 2 · URL Router — Extract Contact ID
   ──────────────────────────────────────────────────────────── */

/**
 * The URL query string carries the Firestore document ID:
 *   profile.html?id=AbCdEfGhIjKlMn
 *
 * URLSearchParams provides a clean, native way to parse it.
 * If no `id` param is present, we redirect back to the dashboard.
 */
const params    = new URLSearchParams(window.location.search);
const contactId = params.get('id');

if (!contactId) {
  // Guard: No ID in URL → boot user back to dashboard
  window.location.replace('index.html');
}

/* ────────────────────────────────────────────────────────────
   SECTION 3 · DOM References (Profile Page)
   ──────────────────────────────────────────────────────────── */

// Page loader
const pageLoader      = document.getElementById('page-loader');

// Profile hero section
const profileAvatar   = document.getElementById('profile-avatar');
const profileName     = document.getElementById('profile-name');
const profileBadge    = document.getElementById('profile-badge');
const profileBio      = document.getElementById('profile-bio');
const profileBirthday = document.getElementById('profile-birthday');
const profileLink     = document.getElementById('profile-link');
const profileNotFound = document.getElementById('profile-not-found');

// Media pane containers
const imageGallery    = document.getElementById('image-gallery');
const videoGrid       = document.getElementById('video-grid');

// Admin upload panel & controls
const uploadPanel     = document.getElementById('upload-panel');
const imageDropzone   = document.getElementById('image-dropzone');
const imageFileInput  = document.getElementById('image-file-input');
const uploadProgress  = document.getElementById('upload-progress');
const uploadFill      = document.getElementById('upload-fill');
const videoLinkInput  = document.getElementById('video-link-input');
const videoLinkType   = document.getElementById('video-link-type');
const addVideoBtn     = document.getElementById('btn-add-video');

// Auth elements
const authBadge       = document.getElementById('auth-badge');
const authBadgeLabel  = document.getElementById('auth-badge-label');
const loginBtn        = document.getElementById('btn-login');
const logoutBtn       = document.getElementById('btn-logout');

/* ────────────────────────────────────────────────────────────
   SECTION 4 · Platform Map (Shared Config)
   ──────────────────────────────────────────────────────────── */

const PLATFORM_MAP = {
  facebook:  { label: 'Facebook',  icon: 'fa-brands fa-facebook-f' },
  instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram'  },
  github:    { label: 'GitHub',    icon: 'fa-brands fa-github'     },
  whatsapp:  { label: 'WhatsApp',  icon: 'fa-brands fa-whatsapp'   },
};

/* ────────────────────────────────────────────────────────────
   SECTION 5 · Auth Observer (Role-Based UI on Profile Page)
   ──────────────────────────────────────────────────────────── */

onAuthStateChanged(auth, (user) => {
  if (user) {
    // Admin: show upload controls
    authBadge.classList.add('admin');
    authBadgeLabel.textContent = user.email.split('@')[0];
    loginBtn?.classList.add('hidden');
    logoutBtn?.classList.remove('hidden');
    uploadPanel.classList.remove('hidden');
  } else {
    // Visitor: hide upload controls
    authBadge.classList.remove('admin');
    authBadgeLabel.textContent = 'Visitor';
    loginBtn?.classList.remove('hidden');
    logoutBtn?.classList.add('hidden');
    uploadPanel.classList.add('hidden');
  }
});

/* ────────────────────────────────────────────────────────────
   SECTION 6 · Firestore — Load Contact Profile Data
   ──────────────────────────────────────────────────────────── */

/**
 * Fetches a single contact document from Firestore using the
 * document ID extracted from the URL.
 * On success, populates the hero section. On failure, shows 404 state.
 */
async function loadProfile() {
  try {
    const docRef  = doc(db, 'contacts', contactId);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      // Contact not found — show 404 panel
      profileNotFound.classList.remove('hidden');
      document.querySelector('.profile-hero').classList.add('hidden');
      return;
    }

    const data = docSnap.data();
    const platformData = PLATFORM_MAP[data.platform] || { label: data.platform, icon: 'fa-solid fa-user' };

    // ── Populate Hero ───────────────────────────────────────
    // Set avatar icon and platform colour
    profileAvatar.innerHTML  = `<i class="${platformData.icon}" aria-hidden="true"></i>`;
    profileAvatar.dataset.platform = data.platform;

    // Text content (escaped to prevent XSS)
    profileName.textContent     = data.name || 'Unnamed Contact';
    profileBio.textContent      = data.bio  || 'No biography provided.';
    profileBirthday.textContent = data.birthday ? formatDate(data.birthday) : 'Not specified';

    // Platform badge
    profileBadge.textContent  = platformData.label;
    profileBadge.className    = `platform-badge ${data.platform}`;

    // External profile link button
    if (data.profileUrl) {
      profileLink.href = sanitizeUrl(data.profileUrl);
      profileLink.classList.remove('hidden');
    }

    // Update page <title> and meta
    document.title = `${data.name} — Memory Vault`;

    // ── Load Media Sub-collections ──────────────────────────
    await Promise.all([
      loadImages(),
      loadVideos(),
    ]);

  } catch (err) {
    console.error('[Vault] Failed to load profile:', err);
    showToast('error', 'Load Error', 'Could not load profile data. Check your connection.');
  } finally {
    // Always hide the page loader
    setTimeout(() => pageLoader.classList.add('hidden'), 400);
  }
}

/* ────────────────────────────────────────────────────────────
   SECTION 7 · Load Media Sub-collections
   ──────────────────────────────────────────────────────────── */

/**
 * Fetches image documents from:
 *   /contacts/{contactId}/images
 * Each document contains: { url, caption, uploadedAt }
 */
async function loadImages() {
  imageGallery.innerHTML = '<p class="text-muted text-sm">Loading images…</p>';

  try {
    const q        = query(collection(db, 'contacts', contactId, 'images'), orderBy('uploadedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      imageGallery.innerHTML = getEmptyMediaHTML('fa-solid fa-images', 'No images yet.');
      return;
    }

    imageGallery.innerHTML = '';
    const urls = []; // Collect all URLs for lightbox navigation

    snapshot.forEach((docSnap) => {
      const { url, caption } = docSnap.data();
      urls.push(url);
      const item = buildGalleryItem(url, caption, urls.length - 1);
      imageGallery.appendChild(item);
    });

    // Initialise the Lightbox with the collected URL array
    initLightbox(urls);

  } catch (err) {
    console.error('[Vault] Failed to load images:', err);
    imageGallery.innerHTML = '<p class="text-muted text-sm">Failed to load images.</p>';
  }
}

/**
 * Fetches video documents from:
 *   /contacts/{contactId}/videos
 * Each document contains: { embedId, type, label }
 *   type: 'drive' | 'url'
 */
async function loadVideos() {
  videoGrid.innerHTML = '<p class="text-muted text-sm">Loading videos…</p>';

  try {
    const q        = query(collection(db, 'contacts', contactId, 'videos'), orderBy('addedAt', 'desc'));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      videoGrid.innerHTML = getEmptyMediaHTML('fa-solid fa-film', 'No videos yet.');
      return;
    }

    videoGrid.innerHTML = '';

    snapshot.forEach((docSnap) => {
      const data = docSnap.data();
      const card = buildVideoCard(data);
      videoGrid.appendChild(card);
    });

  } catch (err) {
    console.error('[Vault] Failed to load videos:', err);
    videoGrid.innerHTML = '<p class="text-muted text-sm">Failed to load videos.</p>';
  }
}

/* ────────────────────────────────────────────────────────────
   SECTION 8 · Gallery Item Builder
   ──────────────────────────────────────────────────────────── */

/**
 * Creates a gallery item element with click-to-lightbox support.
 * @param {string} url     — Full image URL (from Firebase Storage).
 * @param {string} caption — Optional caption string.
 * @param {number} index   — Index into the urls array for lightbox.
 * @returns {HTMLElement}
 */
function buildGalleryItem(url, caption, index) {
  const item = document.createElement('div');
  item.className = 'gallery-item';
  item.dataset.index = index;
  item.setAttribute('role', 'button');
  item.setAttribute('tabindex', '0');
  item.setAttribute('aria-label', `View image ${index + 1}: ${caption || ''}`);

  item.innerHTML = `
    <img
      src="${escapeHTML(url)}"
      alt="${escapeHTML(caption || `Image ${index + 1}`)}"
      loading="lazy"
      decoding="async"
    />
    <div class="gallery-item-overlay" aria-hidden="true">
      <i class="fa-solid fa-magnifying-glass-plus"></i>
    </div>
  `;

  // Click opens lightbox
  item.addEventListener('click', () => openLightbox(index));
  item.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(index); }
  });

  return item;
}

/* ────────────────────────────────────────────────────────────
   SECTION 9 · Native JS Lightbox
   ──────────────────────────────────────────────────────────── */

/**
 * LIGHTBOX HOW IT WORKS:
 * ─────────────────────
 * The lightbox is a pure native JS implementation — no external libraries.
 *
 * 1. `initLightbox(urls)` stores the full URL array in a closure and
 *    binds the keyboard + button listeners.
 * 2. `openLightbox(index)` sets the <img> src, activates the overlay
 *    (which uses CSS `opacity` + `visibility` transition for smooth show/hide),
 *    and traps body scroll.
 * 3. `closeLightbox()` removes the `active` class and restores scroll.
 * 4. Keyboard navigation: ArrowLeft/Right cycle images; Escape closes.
 * 5. Clicking outside the image (on the backdrop) also closes it.
 *
 * No jQuery, no third-party CSS — just the `#lightbox` element
 * defined in profile.html, controlled entirely by CSS classes.
 */

const lightboxEl    = document.getElementById('lightbox');
const lightboxImg   = document.getElementById('lightbox-img');
const lightboxClose = document.getElementById('lightbox-close');

let _lightboxUrls  = [];
let _currentIndex  = 0;

/** Initialises the lightbox with the full set of image URLs */
function initLightbox(urls) {
  _lightboxUrls = urls;

  // Keyboard navigation (only when lightbox is open)
  document.addEventListener('keydown', (e) => {
    if (!lightboxEl.classList.contains('active')) return;
    if (e.key === 'Escape')     closeLightbox();
    if (e.key === 'ArrowRight') navigateLightbox(1);
    if (e.key === 'ArrowLeft')  navigateLightbox(-1);
  });

  // Close on backdrop click (not on the image itself)
  lightboxEl.addEventListener('click', (e) => {
    if (e.target === lightboxEl) closeLightbox();
  });

  lightboxClose.addEventListener('click', closeLightbox);
}

/** Opens the lightbox at a specific index */
function openLightbox(index) {
  _currentIndex     = index;
  lightboxImg.src   = _lightboxUrls[index];
  lightboxImg.alt   = `Image ${index + 1} of ${_lightboxUrls.length}`;
  lightboxEl.classList.add('active');
  document.body.style.overflow = 'hidden';
  lightboxClose.focus(); // Move focus for accessibility
}

/** Navigates by ±1 relative to the current index (wraps around) */
function navigateLightbox(direction) {
  const total = _lightboxUrls.length;
  _currentIndex = (_currentIndex + direction + total) % total;
  // Briefly fade the image for a smooth transition feel
  lightboxImg.style.opacity = '0';
  setTimeout(() => {
    lightboxImg.src = _lightboxUrls[_currentIndex];
    lightboxImg.style.opacity = '1';
    lightboxImg.style.transition = 'opacity 0.25s ease';
  }, 150);
}

/** Closes the lightbox */
function closeLightbox() {
  lightboxEl.classList.remove('active');
  document.body.style.overflow = '';
  setTimeout(() => { lightboxImg.src = ''; }, 500); // Free the image after transition
}

/* ────────────────────────────────────────────────────────────
   SECTION 10 · Video Card Builder
   ──────────────────────────────────────────────────────────── */

/**
 * Builds a video card element that renders either:
 *  - A Google Drive embedded <iframe> (when type === 'drive')
 *  - An HTML5 <video> or direct URL <iframe> (when type === 'url')
 *
 * GOOGLE DRIVE VIDEO EMBEDDING:
 * ──────────────────────────────
 * To embed a Google Drive video, store only the FILE ID in Firestore.
 * File ID is the long string in a Drive share link:
 *   https://drive.google.com/file/d/[FILE_ID_HERE]/view?usp=sharing
 *
 * The embed URL format is:
 *   https://drive.google.com/file/d/{fileId}/preview
 *
 * This renders natively in an <iframe> without needing any API key.
 * Make sure the Google Drive file sharing is set to "Anyone with the link".
 *
 * @param {{ embedId:string, type:'drive'|'url', label:string }} data
 * @returns {HTMLElement}
 */
function buildVideoCard(data) {
  const { embedId, type, label } = data;
  const card = document.createElement('div');
  card.className = 'video-card';

  let mediaHTML = '';

  if (type === 'drive') {
    // ── Google Drive Embed ──────────────────────────────────
    const driveUrl = `https://drive.google.com/file/d/${escapeHTML(embedId)}/preview`;
    mediaHTML = `
      <iframe
        src="${driveUrl}"
        allow="autoplay"
        allowfullscreen
        title="${escapeHTML(label || 'Video')}"
        loading="lazy"
      ></iframe>`;
  } else if (type === 'url') {
    // ── Direct URL — try HTML5 video first ─────────────────
    // Supports .mp4, .webm, .ogg URLs; falls back to an iframe embed.
    const isDirectVideo = /\.(mp4|webm|ogg)(\?.*)?$/i.test(embedId);
    if (isDirectVideo) {
      mediaHTML = `
        <video controls preload="metadata">
          <source src="${escapeHTML(embedId)}" />
          Your browser does not support the video tag.
        </video>`;
    } else {
      // Treat as an embeddable URL (YouTube, Vimeo, etc.)
      mediaHTML = `
        <iframe
          src="${escapeHTML(embedId)}"
          allowfullscreen
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          title="${escapeHTML(label || 'Video')}"
          loading="lazy"
        ></iframe>`;
    }
  }

  card.innerHTML = `
    <div class="video-wrapper">
      ${mediaHTML}
    </div>
    <div class="video-meta">
      <span class="video-label">
        <i class="${type === 'drive' ? 'fa-brands fa-google-drive' : 'fa-solid fa-play'}" aria-hidden="true"></i>
        ${escapeHTML(label || (type === 'drive' ? 'Drive Video' : 'Video'))}
      </span>
    </div>
  `;

  return card;
}

/* ────────────────────────────────────────────────────────────
   SECTION 11 · Tab Navigation System
   ──────────────────────────────────────────────────────────── */

/**
 * Implements tab switching with ARIA attributes for accessibility.
 * The active tab button gets `aria-selected="true"` and the corresponding
 * pane becomes visible via the `.active` class.
 */
const tabBtns  = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');

tabBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.tab;

    tabBtns.forEach((b) => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });

    tabPanes.forEach((p) => p.classList.remove('active'));

    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
    document.getElementById(`tab-${target}`).classList.add('active');
  });
});

/* ────────────────────────────────────────────────────────────
   SECTION 12 · Admin — Image Upload (Firebase Storage)
   ──────────────────────────────────────────────────────────── */

/**
 * Handles image file uploads:
 * 1. User selects or drops an image file.
 * 2. File is uploaded to Firebase Storage at:
 *      /contacts/{contactId}/images/{timestamp}_{filename}
 * 3. After upload, getDownloadURL() fetches the public URL.
 * 4. A new document is written to Firestore sub-collection:
 *      /contacts/{contactId}/images/{autoId}
 *    with fields: { url, caption, uploadedAt }
 * 5. Gallery refreshes.
 */
imageDropzone.addEventListener('click', () => imageFileInput.click());
imageFileInput.addEventListener('change', handleImageUpload);

// Drag and drop visual feedback
imageDropzone.addEventListener('dragover', (e) => {
  e.preventDefault();
  imageDropzone.classList.add('drag-over');
});

imageDropzone.addEventListener('dragleave', () => {
  imageDropzone.classList.remove('drag-over');
});

imageDropzone.addEventListener('drop', (e) => {
  e.preventDefault();
  imageDropzone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processImageUpload(file);
});

function handleImageUpload(e) {
  const file = e.target.files[0];
  if (file) processImageUpload(file);
}

/**
 * Executes the actual file upload with a resumable upload task.
 * @param {File} file — The image File object to upload.
 */
async function processImageUpload(file) {
  // Validate file type
  if (!file.type.startsWith('image/')) {
    showToast('error', 'Invalid File', 'Please select an image file (JPG, PNG, WebP, etc.)');
    return;
  }

  // 10MB size cap
  if (file.size > 10 * 1024 * 1024) {
    showToast('error', 'File Too Large', 'Images must be under 10MB.');
    return;
  }

  // Build a unique storage path to prevent collisions
  const timestamp  = Date.now();
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `contacts/${contactId}/images/${timestamp}_${safeName}`;

  const storageRef  = ref(storage, storagePath);
  const uploadTask  = uploadBytesResumable(storageRef, file);

  // Show progress bar
  uploadProgress.classList.add('visible');
  uploadFill.style.width = '0%';

  uploadTask.on(
    'state_changed',

    // ── Progress snapshot ───────────────────────────────────
    (snapshot) => {
      const pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      uploadFill.style.width = `${pct}%`;
    },

    // ── Upload error ────────────────────────────────────────
    (err) => {
      console.error('[Vault] Upload error:', err);
      uploadProgress.classList.remove('visible');
      showToast('error', 'Upload Failed', err.message || 'An error occurred during upload.');
    },

    // ── Upload complete ─────────────────────────────────────
    async () => {
      try {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

        // Write metadata to Firestore sub-collection
        await addDoc(collection(db, 'contacts', contactId, 'images'), {
          url:        downloadURL,
          caption:    file.name.replace(/\.[^.]+$/, ''), // Use filename as caption
          uploadedAt: serverTimestamp(),
        });

        uploadProgress.classList.remove('visible');
        uploadFill.style.width = '0%';
        imageFileInput.value   = ''; // Reset file input

        showToast('success', 'Image Uploaded', `"${file.name}" is now in the gallery.`);
        await loadImages(); // Refresh gallery
      } catch (err) {
        console.error('[Vault] Firestore write error after upload:', err);
        showToast('error', 'Metadata Error', 'Image uploaded but could not save the record.');
      }
    }
  );
}

/* ────────────────────────────────────────────────────────────
   SECTION 13 · Admin — Add Video Link
   ──────────────────────────────────────────────────────────── */

/**
 * Handles adding a video link (Drive file ID or direct URL) to Firestore.
 * The admin selects the type (Drive / URL), pastes the link, and submits.
 * A new document is created in:
 *   /contacts/{contactId}/videos/{autoId}
 * with fields: { embedId, type, label, addedAt }
 */
addVideoBtn.addEventListener('click', async () => {
  const rawInput = videoLinkInput.value.trim();
  const type     = videoLinkType.value;

  if (!rawInput) {
    showToast('error', 'Missing Input', 'Please enter a Google Drive File ID or video URL.');
    return;
  }

  setButtonLoading(addVideoBtn, true, 'Saving…');

  try {
    await addDoc(collection(db, 'contacts', contactId, 'videos'), {
      embedId: rawInput,
      type,
      label:   type === 'drive' ? 'Drive Video' : 'Video',
      addedAt: serverTimestamp(),
    });

    videoLinkInput.value = '';
    showToast('success', 'Video Added', 'The video has been saved to this profile.');
    await loadVideos(); // Refresh video grid
  } catch (err) {
    console.error('[Vault] Add video failed:', err);
    showToast('error', 'Save Failed', 'Could not save the video. Check Firestore rules.');
  } finally {
    setButtonLoading(addVideoBtn, false, '<i class="fa-solid fa-plus"></i> Add Video');
  }
});

/* ────────────────────────────────────────────────────────────
   SECTION 14 · Header Scroll Effect (shared)
   ──────────────────────────────────────────────────────────── */

const siteHeader = document.querySelector('.site-header');

window.addEventListener('scroll', () => {
  siteHeader?.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/* ────────────────────────────────────────────────────────────
   SECTION 15 · Shared Utility Functions
   ──────────────────────────────────────────────────────────── */

/** XSS-safe HTML entity escaping */
function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str ?? '').replace(/[&<>"']/g, (m) => map[m]);
}

/** Format ISO date string → readable format */
function formatDate(isoDate) {
  try {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

/**
 * Sanitises a URL to prevent javascript: injection.
 * Only allows http/https protocols.
 * @param {string} url
 * @returns {string}
 */
function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return '#';
    return url;
  } catch {
    return '#';
  }
}

/** Empty media state helper */
function getEmptyMediaHTML(icon, text) {
  return `
    <div class="empty-state" style="padding:var(--sp-12) var(--sp-4)">
      <div class="empty-icon"><i class="${icon}" aria-hidden="true"></i></div>
      <p class="empty-title">${text}</p>
    </div>`;
}

/** Button loading state toggle */
function setButtonLoading(btn, loading, html = '') {
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Wait…';
  } else {
    btn.innerHTML = html || btn.dataset.originalHtml || btn.innerHTML;
  }
}

/** Toast notification (same logic as main.js, duplicated to avoid shared module dependency) */
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const icons = {
    success: 'fa-solid fa-circle-check',
    error:   'fa-solid fa-circle-exclamation',
    info:    'fa-solid fa-circle-info',
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
    <button class="btn-icon" style="margin-left:auto;border:none;background:none;color:#64748b;" aria-label="Dismiss">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  const dismiss = () => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  };
  toast.querySelector('button').addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

/* ────────────────────────────────────────────────────────────
   SECTION 16 · Lightbox Arrow Button Events
   Listens for custom events dispatched by the inline <script>
   in profile.html so prev/next arrows work without shared globals.
   ──────────────────────────────────────────────────────────── */

document.addEventListener('lightbox:prev', () => navigateLightbox(-1));
document.addEventListener('lightbox:next', () => navigateLightbox(1));

/* ────────────────────────────────────────────────────────────
   SECTION 17 · Page Initialisation
   ──────────────────────────────────────────────────────────── */

// Kick off the profile load on DOM ready
document.addEventListener('DOMContentLoaded', loadProfile);
