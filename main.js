/**
 * ============================================================
 *  Personal Cloud & Memory Vault — main.js
 *  Dashboard logic: Firebase Auth + Firestore contacts CRUD
 *  Author  : Elite Full-Stack Developer
 *  Version : 1.0.0
 * ============================================================
 */

/* ────────────────────────────────────────────────────────────
   SECTION 1 · Firebase Configuration
   ──────────────────────────────────────────────────────────── */

/**
 * 🔧 CUSTOMISE THIS BLOCK:
 *    Replace the placeholder values below with your actual Firebase
 *    project configuration. You find them in:
 *    Firebase Console → Project Settings → Your apps → SDK setup
 */
import { initializeApp }                   from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth,
         signInWithEmailAndPassword,
         signOut,
         onAuthStateChanged }              from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore,
         collection,
         addDoc,
         getDocs,
         deleteDoc,
         doc,
         query,
         orderBy,
         serverTimestamp }                 from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ──────────────────────────────────────────────────────────
// 🔑 PASTE YOUR FIREBASE CONFIG HERE
// ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyCRmbz_f1iVnD36iz3JJvLziA1Lr1Jp-nI",           // ← Replace
  authDomain:        "my-personal-cloud-f2c31.firebaseapp.com",       // ← Replace
  projectId:         "my-personal-cloud-f2c31",        // ← Replace
  storageBucket:     "my-personal-cloud-f2c31.firebasestorage.app",    // ← Replace
  messagingSenderId: "1069957164590", // ← Replace
  appId:             "1:1069957164590:web:51221429318bc4260bb9bf"             // ← Replace
};

// Initialise Firebase services
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

/* ────────────────────────────────────────────────────────────
   SECTION 2 · DOM References
   ──────────────────────────────────────────────────────────── */

// Header / nav elements
const authBadge       = document.getElementById('auth-badge');
const authBadgeLabel  = document.getElementById('auth-badge-label');
const loginBtn        = document.getElementById('btn-login');
const logoutBtn       = document.getElementById('btn-logout');

// Auth Modal
const loginModal      = document.getElementById('login-modal');
const modalCloseBtn   = document.getElementById('modal-close');
const loginForm       = document.getElementById('login-form');
const loginEmail      = document.getElementById('login-email');
const loginPassword   = document.getElementById('login-password');
const loginSubmitBtn  = document.getElementById('login-submit');
const loginError      = document.getElementById('login-error');

// Admin Panel
const adminPanel      = document.getElementById('admin-panel');
const addContactForm  = document.getElementById('add-contact-form');
const contactNameEl   = document.getElementById('contact-name');
const contactPlatform = document.getElementById('contact-platform');
const contactUrl      = document.getElementById('contact-url');
const contactBio      = document.getElementById('contact-bio');
const contactBirthday = document.getElementById('contact-birthday');
const addContactBtn   = document.getElementById('btn-add-contact');

// Contacts display
const contactsGrid    = document.getElementById('contacts-grid');
const contactsCount   = document.getElementById('contacts-count');

// Page Loader
const pageLoader      = document.getElementById('page-loader');

/* ────────────────────────────────────────────────────────────
   SECTION 3 · Platform Configuration Map
   ──────────────────────────────────────────────────────────── */

/** Maps each platform key to its display name and FontAwesome icon class */
const PLATFORM_MAP = {
  facebook:  { label: 'Facebook',  icon: 'fa-brands fa-facebook-f' },
  instagram: { label: 'Instagram', icon: 'fa-brands fa-instagram'  },
  github:    { label: 'GitHub',    icon: 'fa-brands fa-github'     },
  whatsapp:  { label: 'WhatsApp',  icon: 'fa-brands fa-whatsapp'   },
};

/* ────────────────────────────────────────────────────────────
   SECTION 4 · Auth State Observer (Role-Based UI)
   ──────────────────────────────────────────────────────────── */

/**
 * onAuthStateChanged fires every time the user logs in or out.
 * This is the single source of truth for the entire role-based UI system.
 * - Admin (logged-in): shows admin panel, logout button, hides login button.
 * - Visitor (logged-out): hides admin panel, shows login button.
 */
onAuthStateChanged(auth, (user) => {
  if (user) {
    // ── Admin Mode ──────────────────────────────────────────
    authBadge.classList.add('admin');
    authBadgeLabel.textContent = user.email.split('@')[0]; // Show username portion
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    adminPanel.classList.remove('hidden');

    // Re-render contacts with delete buttons visible
    renderContacts(true);
  } else {
    // ── Visitor Mode ────────────────────────────────────────
    authBadge.classList.remove('admin');
    authBadgeLabel.textContent = 'Visitor';
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    adminPanel.classList.add('hidden');

    // Re-render contacts without admin controls
    renderContacts(false);
  }
});

/* ────────────────────────────────────────────────────────────
   SECTION 5 · Modal Controls (Login)
   ──────────────────────────────────────────────────────────── */

/** Open the login modal with smooth animation */
function openLoginModal() {
  loginModal.classList.add('active');
  document.body.style.overflow = 'hidden'; // Prevent scroll-behind
  setTimeout(() => loginEmail.focus(), 300);
}

/** Close the login modal and clear any error state */
function closeLoginModal() {
  loginModal.classList.remove('active');
  document.body.style.overflow = '';
  loginError.textContent = '';
  loginError.classList.remove('visible');
}

// Event bindings for modal open / close
loginBtn.addEventListener('click', openLoginModal);
modalCloseBtn.addEventListener('click', closeLoginModal);

// Close modal when clicking the backdrop (outside the card)
loginModal.addEventListener('click', (e) => {
  if (e.target === loginModal) closeLoginModal();
});

// Keyboard: Escape to close
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && loginModal.classList.contains('active')) {
    closeLoginModal();
  }
});

/* ────────────────────────────────────────────────────────────
   SECTION 6 · Firebase Authentication Logic
   ──────────────────────────────────────────────────────────── */

/**
 * Handle login form submission.
 * Uses Firebase signInWithEmailAndPassword with visual loading state.
 */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email    = loginEmail.value.trim();
  const password = loginPassword.value;

  // Basic client-side validation
  if (!email || !password) return;

  // Show loading state on the button
  setButtonLoading(loginSubmitBtn, true, 'Authenticating…');
  loginError.classList.remove('visible');

  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeLoginModal();
    showToast('success', 'Authenticated', 'Admin access granted. Welcome back!');
  } catch (err) {
    // Friendly error messages instead of raw Firebase codes
    loginError.textContent = getFriendlyAuthError(err.code);
    loginError.classList.add('visible');
  } finally {
    setButtonLoading(loginSubmitBtn, false, '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In');
  }
});

/**
 * Handle logout.
 */
logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showToast('info', 'Signed Out', 'You are now browsing in visitor mode.');
  } catch (err) {
    showToast('error', 'Error', 'Could not sign out. Please try again.');
  }
});

/* ────────────────────────────────────────────────────────────
   SECTION 7 · Firestore — Contacts Collection
   ──────────────────────────────────────────────────────────── */

/**
 * Fetches all contacts from Firestore and renders them.
 * Called on auth state change to ensure role-based controls are correct.
 *
 * @param {boolean} isAdmin — Whether to show delete buttons on cards.
 */
async function renderContacts(isAdmin) {
  // Show loading skeletons while fetching
  contactsGrid.innerHTML = getSkeletonHTML(6);

  try {
    // Query the "contacts" collection, sorted by creation time descending
    const q          = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const snapshot   = await getDocs(q);
    const contacts   = [];

    snapshot.forEach((docSnap) => {
      contacts.push({ id: docSnap.id, ...docSnap.data() });
    });

    // Update the counter badge
    contactsCount.textContent = contacts.length;

    if (contacts.length === 0) {
      contactsGrid.innerHTML = getEmptyStateHTML(isAdmin);
      return;
    }

    // Build and inject cards
    contactsGrid.innerHTML = '';
    contactsGrid.classList.add('stagger-children');

    contacts.forEach((contact) => {
      const card = buildContactCard(contact, isAdmin);
      contactsGrid.appendChild(card);
    });

  } catch (err) {
    console.error('[Vault] Failed to load contacts:', err);
    showToast('error', 'Load Error', 'Could not fetch contacts. Check Firestore rules.');
    contactsGrid.innerHTML = getErrorStateHTML();
  }
}

/**
 * Builds a complete contact card DOM element.
 *
 * @param {Object}  contact — Firestore document data + id field.
 * @param {boolean} isAdmin — Determines if delete button is rendered.
 * @returns {HTMLElement}
 */
function buildContactCard(contact, isAdmin) {
  const { id, name, platform, bio, birthday, profileUrl } = contact;
  const platformData = PLATFORM_MAP[platform] || { label: platform, icon: 'fa-solid fa-user' };

  const card = document.createElement('article');
  card.className    = 'contact-card animate-fade-up';
  card.dataset.platform = platform;
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View profile of ${name}`);

  card.innerHTML = `
    <div class="card-top">
      <div class="card-avatar" aria-hidden="true">
        <i class="${platformData.icon}"></i>
      </div>
      <span class="platform-badge ${platform}">${platformData.label}</span>
    </div>

    <h3 class="card-name">${escapeHTML(name)}</h3>
    <p class="card-bio">${escapeHTML(bio || 'No bio provided.')}</p>

    <div class="card-footer">
      <span class="card-birthday">
        <i class="fa-regular fa-calendar" aria-hidden="true"></i>
        ${birthday ? formatDate(birthday) : '—'}
      </span>
      <div class="card-arrow" aria-hidden="true">
        <i class="fa-solid fa-arrow-right"></i>
      </div>
    </div>

    ${isAdmin ? `
      <button
        class="btn btn-danger btn-icon delete-card-btn"
        data-id="${id}"
        aria-label="Delete ${escapeHTML(name)}"
        style="position:absolute;top:var(--sp-4);right:var(--sp-4);width:32px;height:32px;font-size:0.75rem;z-index:10;"
        title="Delete contact"
      >
        <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
      </button>` : ''}
  `;

  /* ── Card Interactions ─────────────────────────────── */

  // Navigate to profile page on click (not the delete button)
  card.addEventListener('click', (e) => {
    if (e.target.closest('.delete-card-btn')) return; // Skip if deleting
    window.location.href = `profile.html?id=${id}`;
  });

  // Keyboard: Enter / Space to navigate
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.delete-card-btn')) {
      e.preventDefault();
      window.location.href = `profile.html?id=${id}`;
    }
  });

  // Delete handler for admin
  if (isAdmin) {
    const deleteBtn = card.querySelector('.delete-card-btn');
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Permanently delete "${name}"?\nThis also removes all their media sub-collections.`)) return;

      setButtonLoading(deleteBtn, true);
      try {
        await deleteDoc(doc(db, 'contacts', id));
        card.style.transform = 'scale(0.9)';
        card.style.opacity   = '0';
        card.style.transition = 'all 0.3s ease';
        setTimeout(() => {
          card.remove();
          // Recalculate count
          contactsCount.textContent = contactsGrid.querySelectorAll('.contact-card').length;
          if (contactsGrid.querySelectorAll('.contact-card').length === 0) {
            contactsGrid.innerHTML = getEmptyStateHTML(true);
          }
        }, 300);
        showToast('success', 'Deleted', `"${name}" has been removed.`);
      } catch (err) {
        console.error('[Vault] Delete failed:', err);
        showToast('error', 'Delete Failed', 'Could not remove this contact.');
        setButtonLoading(deleteBtn, false);
      }
    });
  }

  return card;
}

/* ────────────────────────────────────────────────────────────
   SECTION 8 · Add Contact Form (Admin Only)
   ──────────────────────────────────────────────────────────── */

/**
 * Handles the submission of the "Add New Contact" form.
 * Validates input fields, then pushes data to Firestore.
 */
addContactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateContactForm()) return;

  setButtonLoading(addContactBtn, true, '<i class="fa-solid fa-spinner fa-spin"></i> Saving…');

  const contactData = {
    name:       contactNameEl.value.trim(),
    platform:   contactPlatform.value,
    profileUrl: contactUrl.value.trim(),
    bio:        contactBio.value.trim(),
    birthday:   contactBirthday.value,
    createdAt:  serverTimestamp(),
  };

  try {
    await addDoc(collection(db, 'contacts'), contactData);
    addContactForm.reset();
    showToast('success', 'Contact Added', `${contactData.name} was added to your vault.`);
    renderContacts(true); // Refresh the grid
  } catch (err) {
    console.error('[Vault] Add contact failed:', err);
    showToast('error', 'Save Failed', 'Could not save the contact. Check Firestore rules.');
  } finally {
    setButtonLoading(addContactBtn, false, '<i class="fa-solid fa-plus"></i> Add to Vault');
  }
});

/**
 * Client-side form validation for the Add Contact form.
 * @returns {boolean} — true if valid, false otherwise.
 */
function validateContactForm() {
  let valid = true;

  const fields = [
    { el: contactNameEl,   id: 'err-name',     msg: 'Full name is required.' },
    { el: contactPlatform, id: 'err-platform',  msg: 'Please select a platform.' },
    { el: contactUrl,      id: 'err-url',       msg: 'Profile URL is required.' },
  ];

  fields.forEach(({ el, id, msg }) => {
    const errEl = document.getElementById(id);
    if (!el.value.trim()) {
      el.classList.add('is-error');
      if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
      valid = false;
    } else {
      el.classList.remove('is-error');
      if (errEl) errEl.classList.remove('visible');
    }
  });

  return valid;
}

// Clear validation state on input
[contactNameEl, contactPlatform, contactUrl].forEach((el) => {
  el.addEventListener('input', () => {
    el.classList.remove('is-error');
    const errEl = document.getElementById(el.dataset.errTarget);
    if (errEl) errEl.classList.remove('visible');
  });
});

/* ────────────────────────────────────────────────────────────
   SECTION 9 · Header Scroll Effect
   ──────────────────────────────────────────────────────────── */

const siteHeader = document.querySelector('.site-header');

window.addEventListener('scroll', () => {
  siteHeader.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/* ────────────────────────────────────────────────────────────
   SECTION 10 · Utility Functions
   ──────────────────────────────────────────────────────────── */

/**
 * Displays a toast notification.
 * @param {'success'|'error'|'info'} type
 * @param {string} title
 * @param {string} message
 * @param {number} [duration=4000] — Auto-dismiss time in ms.
 */
function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = {
    success: 'fa-solid fa-circle-check',
    error:   'fa-solid fa-circle-exclamation',
    info:    'fa-solid fa-circle-info',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');
  toast.innerHTML = `
    <div class="toast-icon"><i class="${icons[type]}" aria-hidden="true"></i></div>
    <div class="toast-body">
      <p class="toast-title">${escapeHTML(title)}</p>
      <p class="toast-message">${escapeHTML(message)}</p>
    </div>
    <button class="btn-icon" style="margin-left:auto;border:none;background:none;color:#64748b;font-size:0.9rem;" aria-label="Dismiss">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;

  const dismissBtn = toast.querySelector('button');
  const dismiss = () => {
    toast.classList.add('exit');
    setTimeout(() => toast.remove(), 300);
  };
  dismissBtn.addEventListener('click', dismiss);

  container.appendChild(toast);
  setTimeout(dismiss, duration);
}

/**
 * Toggles a button between loading and normal state.
 * @param {HTMLButtonElement} btn
 * @param {boolean} loading
 * @param {string}  [html] — HTML to restore when loading = false.
 */
function setButtonLoading(btn, loading, html = '') {
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Please wait…';
  } else {
    btn.innerHTML = html || btn.dataset.originalHtml || btn.innerHTML;
  }
}

/**
 * Sanitizes a string to prevent XSS when injecting into innerHTML.
 * @param {string} str
 * @returns {string}
 */
function escapeHTML(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Formats an ISO date string (YYYY-MM-DD) into a readable format.
 * @param {string} isoDate
 * @returns {string}
 */
function formatDate(isoDate) {
  if (!isoDate) return '—';
  try {
    const d = new Date(isoDate + 'T00:00:00'); // Force local TZ
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return isoDate;
  }
}

/**
 * Converts Firebase Auth error codes to user-friendly messages.
 * @param {string} code — Firebase error code.
 * @returns {string}
 */
function getFriendlyAuthError(code) {
  const messages = {
    'auth/user-not-found':    'No account found with this email address.',
    'auth/wrong-password':    'Incorrect password. Please try again.',
    'auth/invalid-email':     'Please enter a valid email address.',
    'auth/too-many-requests': 'Too many failed attempts. Try again later.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/invalid-credential': 'Invalid credentials. Check email and password.',
  };
  return messages[code] || 'Authentication failed. Please try again.';
}

/* ────────────────────────────────────────────────────────────
   SECTION 11 · HTML Helpers
   ──────────────────────────────────────────────────────────── */

/** Returns skeleton placeholder HTML for n cards */
function getSkeletonHTML(n) {
  return Array(n).fill('<div class="skeleton-card" aria-hidden="true"></div>').join('');
}

/** Returns empty state HTML */
function getEmptyStateHTML(isAdmin) {
  return `
    <div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-vault" aria-hidden="true"></i></div>
      <h3 class="empty-title">Vault is Empty</h3>
      <p class="empty-sub">
        ${isAdmin
          ? 'Use the form above to add your first contact.'
          : 'No contacts have been added yet.'}
      </p>
    </div>`;
}

/** Returns error state HTML */
function getErrorStateHTML() {
  return `
    <div class="empty-state">
      <div class="empty-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div>
      <h3 class="empty-title">Could not load contacts</h3>
      <p class="empty-sub">Check your Firebase configuration and Firestore rules.</p>
    </div>`;
}

/* ────────────────────────────────────────────────────────────
   SECTION 12 · Page Init
   ──────────────────────────────────────────────────────────── */

/**
 * Hides the page loader once the DOM + initial data are ready.
 * The onAuthStateChanged observer already triggers renderContacts,
 * so we only need to ensure the loader disappears cleanly.
 */
window.addEventListener('load', () => {
  setTimeout(() => {
    pageLoader.classList.add('hidden');
  }, 400);
});
