/**
 * Memory Vault — main.js  v2.0
 * Dashboard: Firebase Auth + Firestore CRUD
 * Handles: Files, Profiles (containers) + nested contacts + direct contacts
 * No Firebase Storage — media via URLs only
 */

/* ─── Firebase Imports ──────────────────────────────────────────────────── */
import { initializeApp }                from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged }
                                         from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc,
         query, orderBy, serverTimestamp, updateDoc }
                                         from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/* ─── 🔑 Firebase Config — Replace with your project values ────────────── */
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

/* ─── DOM References ────────────────────────────────────────────────────── */
const authBadge      = document.getElementById('auth-badge');
const authBadgeLabel = document.getElementById('auth-badge-label');
const loginBtn       = document.getElementById('btn-login');
const logoutBtn      = document.getElementById('btn-logout');
const loginModal     = document.getElementById('login-modal');
const modalCloseBtn  = document.getElementById('modal-close');
const loginForm      = document.getElementById('login-form');
const loginEmail     = document.getElementById('login-email');
const loginPassword  = document.getElementById('login-password');
const loginSubmitBtn = document.getElementById('login-submit');
const loginError     = document.getElementById('login-error');
const adminPanel     = document.getElementById('admin-panel');
const pageLoader     = document.getElementById('page-loader');

// Views
const dashboardView  = document.getElementById('dashboard-view');
const nestedView     = document.getElementById('nested-view');
const breadcrumbNav  = document.getElementById('breadcrumb-nav');

// Dashboard sections
const containersGrid  = document.getElementById('containers-grid');
const containersCount = document.getElementById('containers-count');
const contactsGrid    = document.getElementById('contacts-grid');
const contactsCount   = document.getElementById('contacts-count');

// Nested view
const nestedContactsGrid  = document.getElementById('nested-contacts-grid');
const nestedContactsCount = document.getElementById('nested-contacts-count');
const nestedContainerTitle= document.getElementById('nested-container-title');
const nestedEyebrow       = document.getElementById('nested-eyebrow');
const breadcrumbName      = document.getElementById('breadcrumb-name');

// Admin forms
const adminDashForms     = document.getElementById('admin-dashboard-forms');
const adminNestedForms   = document.getElementById('admin-nested-forms');
const nestedContLabel    = document.getElementById('nested-container-name-label');

// Add Container forms
const addFileForm     = document.getElementById('add-file-form');
const fileNameEl      = document.getElementById('file-name');
const fileDescEl      = document.getElementById('file-desc');
const addFileBtn      = document.getElementById('btn-add-file');

const addProfileForm  = document.getElementById('add-profile-form');
const profileNameEl   = document.getElementById('profile-name-input');
const profileDescEl   = document.getElementById('profile-desc');
const addProfileBtn   = document.getElementById('btn-add-profile');

// Direct contact form
const addContactForm  = document.getElementById('add-contact-form');
const contactNameEl   = document.getElementById('contact-name');
const contactPlatform = document.getElementById('contact-platform');
const contactUrl      = document.getElementById('contact-url');
const contactBio      = document.getElementById('contact-bio');
const contactBirthday = document.getElementById('contact-birthday');
const addContactBtn   = document.getElementById('btn-add-contact');

// Nested contact form
const addNestedForm     = document.getElementById('add-nested-contact-form');
const nestedNameEl      = document.getElementById('nested-contact-name');
const nestedPlatformEl  = document.getElementById('nested-contact-platform');
const nestedUrlEl       = document.getElementById('nested-contact-url');
const nestedBioEl       = document.getElementById('nested-contact-bio');
const nestedBirthdayEl  = document.getElementById('nested-contact-birthday');
const addNestedBtn      = document.getElementById('btn-add-nested-contact');

/* ─── State ─────────────────────────────────────────────────────────────── */
let isAdmin       = false;
let currentContainerId = null; // set when in nested view

/* ─── Platform Map ──────────────────────────────────────────────────────── */
const PLATFORM_MAP = {
  facebook:  { label:'Facebook',  icon:'fa-brands fa-facebook-f' },
  instagram: { label:'Instagram', icon:'fa-brands fa-instagram'  },
  github:    { label:'GitHub',    icon:'fa-brands fa-github'     },
  whatsapp:  { label:'WhatsApp',  icon:'fa-brands fa-whatsapp'   },
};

/* ══════════════════════════════════════════════════════════════════════════
   URL ROUTING — detect ?container= param
   ══════════════════════════════════════════════════════════════════════════ */
const urlParams     = new URLSearchParams(window.location.search);
const containerParam = urlParams.get('container');

/* ══════════════════════════════════════════════════════════════════════════
   AUTH STATE
   ══════════════════════════════════════════════════════════════════════════ */
onAuthStateChanged(auth, (user) => {
  if (user) {
    isAdmin = true;
    authBadge.classList.add('admin');
    authBadgeLabel.textContent = user.email.split('@')[0];
    loginBtn.classList.add('hidden');
    logoutBtn.classList.remove('hidden');
    adminPanel.classList.remove('hidden');
  } else {
    isAdmin = false;
    authBadge.classList.remove('admin');
    authBadgeLabel.textContent = 'Visitor';
    loginBtn.classList.remove('hidden');
    logoutBtn.classList.add('hidden');
    adminPanel.classList.add('hidden');
  }
  initPage();
});

/* ══════════════════════════════════════════════════════════════════════════
   PAGE INIT — decide which view to show
   ══════════════════════════════════════════════════════════════════════════ */
async function initPage() {
  if (containerParam) {
    // ── Nested view: show contacts inside a specific container
    currentContainerId = containerParam;
    dashboardView.classList.add('hidden');
    nestedView.classList.remove('hidden');
    breadcrumbNav.classList.remove('hidden');
    adminDashForms.classList.add('hidden');
    adminNestedForms.classList.remove('hidden');

    // Fetch container name for breadcrumb + title
    try {
      const { getDoc } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      const snap = await getDoc(doc(db, 'containers', containerParam));
      if (snap.exists()) {
        const cdata = snap.data();
        breadcrumbName.textContent         = cdata.name;
        nestedContainerTitle.textContent   = cdata.name;
        nestedContLabel.textContent        = cdata.name;
        nestedEyebrow.innerHTML = `<i class="fa-solid fa-${cdata.type === 'file' ? 'folder' : 'user-group'}" aria-hidden="true"></i> ${cdata.type === 'file' ? 'File' : 'Profile'}`;
        document.title = `${cdata.name} — Memory Vault`;
      }
    } catch (_) {}

    renderNestedContacts();
  } else {
    // ── Dashboard view
    dashboardView.classList.remove('hidden');
    nestedView.classList.add('hidden');
    breadcrumbNav.classList.add('hidden');
    adminDashForms.classList.remove('hidden');
    adminNestedForms.classList.add('hidden');
    renderContainers();
    renderContacts();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   MODAL LOGIC
   ══════════════════════════════════════════════════════════════════════════ */
function openLoginModal() {
  loginModal.classList.add('active');
  document.body.style.overflow = 'hidden';
  setTimeout(() => loginEmail.focus(), 300);
}
function closeLoginModal() {
  loginModal.classList.remove('active');
  document.body.style.overflow = '';
  loginError.textContent = '';
  loginError.classList.remove('visible');
}
loginBtn.addEventListener('click', openLoginModal);
modalCloseBtn.addEventListener('click', closeLoginModal);
loginModal.addEventListener('click', (e) => { if (e.target === loginModal) closeLoginModal(); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && loginModal.classList.contains('active')) closeLoginModal();
});

/* ══════════════════════════════════════════════════════════════════════════
   AUTH ACTIONS
   ══════════════════════════════════════════════════════════════════════════ */
loginForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = loginEmail.value.trim();
  const password = loginPassword.value;
  if (!email || !password) return;

  setButtonLoading(loginSubmitBtn, true);
  loginError.classList.remove('visible');
  try {
    await signInWithEmailAndPassword(auth, email, password);
    closeLoginModal();
    showToast('success', 'Authenticated', 'Admin access granted. Welcome back!');
  } catch (err) {
    loginError.textContent = getFriendlyAuthError(err.code);
    loginError.classList.add('visible');
  } finally {
    setButtonLoading(loginSubmitBtn, false, '<i class="fa-solid fa-arrow-right-to-bracket"></i> Sign In');
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    await signOut(auth);
    showToast('info', 'Signed Out', 'Browsing in visitor mode.');
  } catch {
    showToast('error', 'Error', 'Could not sign out.');
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ADMIN PANEL TYPE TABS
   ══════════════════════════════════════════════════════════════════════════ */
document.querySelectorAll('.admin-type-tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-type-tab').forEach((t) => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.admin-form').forEach((f) => f.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById(`form-${tab.dataset.form}`).classList.add('active');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   RENDER CONTAINERS (Files & Profiles)
   ══════════════════════════════════════════════════════════════════════════ */
async function renderContainers() {
  containersGrid.innerHTML = '<div class="skeleton-card" aria-hidden="true"></div><div class="skeleton-card" aria-hidden="true"></div>';
  try {
    const q        = query(collection(db, 'containers'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const items    = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

    // Visitors: filter only public
    const visible = isAdmin ? items : items.filter((c) => c.isPublic !== false);
    containersCount.textContent = visible.length;

    if (visible.length === 0) {
      containersGrid.innerHTML = getEmptyStateHTML(
        'fa-solid fa-folder-open',
        isAdmin ? 'No collections yet. Create a File or Profile above.' : 'No collections available.'
      );
      return;
    }
    containersGrid.innerHTML = '';
    containersGrid.classList.add('stagger-children');
    visible.forEach((container) => containersGrid.appendChild(buildContainerCard(container)));
  } catch (err) {
    console.error('[Vault] Failed to load containers:', err);
    containersGrid.innerHTML = getErrorStateHTML();
  }
}

function buildContainerCard(container) {
  const { id, name, type, description, isPublic } = container;
  const isFile = type === 'file';
  const icon   = isFile ? 'fa-solid fa-folder-open' : 'fa-solid fa-user-group';

  const card = document.createElement('article');
  card.className = 'container-card animate-fade-up';
  card.setAttribute('data-type', type || 'file');
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `Open ${name}`);

  card.innerHTML = `
    ${!isPublic ? '<span class="card-private-badge" aria-label="Private"><i class="fa-solid fa-lock" style="margin-right:3px"></i>Private</span>' : ''}
    ${isAdmin ? `
      <div class="card-admin-controls">
        <label class="vis-toggle" title="${isPublic !== false ? 'Set Private' : 'Set Public'}">
          <input type="checkbox" class="vis-checkbox" ${isPublic !== false ? 'checked' : ''} data-id="${id}" data-col="containers">
          <span class="vis-track"></span>
        </label>
        <button class="btn btn-danger btn-icon delete-btn" data-id="${id}" data-col="containers" aria-label="Delete ${escapeHTML(name)}" title="Delete">
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>` : ''}
    <div class="container-card-top">
      <div class="container-icon" aria-hidden="true"><i class="${icon}"></i></div>
      <span class="container-type-badge">${isFile ? 'File' : 'Profile'}</span>
    </div>
    <h3 class="container-name">${escapeHTML(name)}</h3>
    ${description ? `<p class="card-bio">${escapeHTML(description)}</p>` : ''}
    <div class="container-footer">
      <span class="container-count">
        <i class="fa-solid fa-users" aria-hidden="true"></i>
        <span class="contact-count-label">Loading…</span>
      </span>
      <div class="card-arrow" aria-hidden="true">
        <i class="fa-solid fa-arrow-right"></i>
      </div>
    </div>
  `;

  // Async load contact count
  getDocs(collection(db, 'containers', id, 'contacts'))
    .then((s) => {
      const label = card.querySelector('.contact-count-label');
      if (label) label.textContent = `${s.size} contact${s.size !== 1 ? 's' : ''}`;
    }).catch(() => {});

  // Navigate on click
  const navigateToContainer = (e) => {
    if (e.target.closest('.card-admin-controls')) return;
    window.location.href = `index.html?container=${id}`;
  };
  card.addEventListener('click', navigateToContainer);
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.card-admin-controls')) {
      e.preventDefault();
      window.location.href = `index.html?container=${id}`;
    }
  });

  // Admin controls
  if (isAdmin) {
    wireAdminControls(card, id, 'containers', name, () => renderContainers());
  }

  return card;
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDER DIRECT CONTACTS
   ══════════════════════════════════════════════════════════════════════════ */
async function renderContacts() {
  contactsGrid.innerHTML = getSkeletonHTML(3);
  try {
    const q        = query(collection(db, 'contacts'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    const items    = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const visible  = isAdmin ? items : items.filter((c) => c.isPublic !== false);

    contactsCount.textContent = visible.length;
    if (visible.length === 0) {
      contactsGrid.innerHTML = getEmptyStateHTML('fa-solid fa-address-book',
        isAdmin ? 'Use the "Direct Contact" tab above to add one.' : 'No public contacts yet.');
      return;
    }
    contactsGrid.innerHTML = '';
    contactsGrid.classList.add('stagger-children');
    visible.forEach((c) => contactsGrid.appendChild(buildContactCard(c, null)));
  } catch (err) {
    console.error('[Vault] Failed to load contacts:', err);
    contactsGrid.innerHTML = getErrorStateHTML();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDER NESTED CONTACTS (inside a container)
   ══════════════════════════════════════════════════════════════════════════ */
async function renderNestedContacts() {
  nestedContactsGrid.innerHTML = getSkeletonHTML(3);
  try {
    const q        = query(
      collection(db, 'containers', currentContainerId, 'contacts'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const items    = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    const visible  = isAdmin ? items : items.filter((c) => c.isPublic !== false);

    nestedContactsCount.textContent = visible.length;
    if (visible.length === 0) {
      nestedContactsGrid.innerHTML = getEmptyStateHTML('fa-solid fa-users',
        isAdmin ? 'Use the form above to add the first contact.' : 'No contacts in this collection yet.');
      return;
    }
    nestedContactsGrid.innerHTML = '';
    nestedContactsGrid.classList.add('stagger-children');
    visible.forEach((c) => nestedContactsGrid.appendChild(buildContactCard(c, currentContainerId)));
  } catch (err) {
    console.error('[Vault] Failed to load nested contacts:', err);
    nestedContactsGrid.innerHTML = getErrorStateHTML();
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   BUILD CONTACT CARD
   ══════════════════════════════════════════════════════════════════════════ */
function buildContactCard(contact, containerId) {
  const { id, name, platform, bio, birthday, profileUrl, isPublic } = contact;
  const platformData = PLATFORM_MAP[platform] || { label: platform || 'Unknown', icon: 'fa-solid fa-user' };

  // Profile page URL varies depending on whether contact is nested
  const profilePageUrl = containerId
    ? `profile.html?id=${id}&containerId=${containerId}`
    : `profile.html?id=${id}`;

  const reloadFn = containerId ? renderNestedContacts : renderContacts;
  const collectionPath = containerId ? `containers/${containerId}/contacts` : 'contacts';

  const card = document.createElement('article');
  card.className = 'contact-card animate-fade-up';
  card.dataset.platform = platform || '';
  card.setAttribute('role', 'button');
  card.setAttribute('tabindex', '0');
  card.setAttribute('aria-label', `View profile of ${name}`);

  card.innerHTML = `
    ${!isPublic ? '<span class="card-private-badge" aria-label="Private"><i class="fa-solid fa-lock" style="margin-right:3px"></i>Private</span>' : ''}
    ${isAdmin ? `
      <div class="card-admin-controls">
        <label class="vis-toggle" title="${isPublic !== false ? 'Set Private' : 'Set Public'}">
          <input type="checkbox" class="vis-checkbox" ${isPublic !== false ? 'checked' : ''} data-id="${id}" data-col="${collectionPath}">
          <span class="vis-track"></span>
        </label>
        <button class="btn btn-danger btn-icon delete-btn" data-id="${id}" data-col="${collectionPath}" aria-label="Delete ${escapeHTML(name)}" title="Delete">
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>` : ''}
    <div class="card-top">
      <div class="card-avatar" aria-hidden="true"><i class="${platformData.icon}"></i></div>
      <span class="platform-badge ${platform || ''}">${platformData.label}</span>
    </div>
    <h3 class="card-name">${escapeHTML(name)}</h3>
    <p class="card-bio">${escapeHTML(bio || 'No bio provided.')}</p>
    <div class="card-footer">
      <span class="card-birthday">
        <i class="fa-regular fa-calendar" aria-hidden="true"></i>
        ${birthday ? formatDate(birthday) : '—'}
      </span>
      <div class="card-arrow" aria-hidden="true"><i class="fa-solid fa-arrow-right"></i></div>
    </div>
  `;

  // Navigate to profile
  card.addEventListener('click', (e) => {
    if (e.target.closest('.card-admin-controls')) return;
    window.location.href = profilePageUrl;
  });
  card.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('.card-admin-controls')) {
      e.preventDefault();
      window.location.href = profilePageUrl;
    }
  });

  if (isAdmin) {
    wireAdminControls(card, id, collectionPath, name, reloadFn);
  }

  return card;
}

/* ══════════════════════════════════════════════════════════════════════════
   WIRE ADMIN CONTROLS (Delete + Visibility Toggle)
   Works for containers, direct contacts, and nested contacts
   ══════════════════════════════════════════════════════════════════════════ */
function wireAdminControls(card, id, collectionPath, name, reloadFn) {
  // Delete button
  const deleteBtn = card.querySelector('.delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
      setButtonLoading(deleteBtn, true);
      try {
        // Build the Firestore doc reference from the path segments
        const pathParts = collectionPath.split('/');
        let docRef;
        if (pathParts.length === 1) {
          docRef = doc(db, pathParts[0], id);
        } else if (pathParts.length === 3) {
          docRef = doc(db, pathParts[0], pathParts[1], pathParts[2], id);
        }
        await deleteDoc(docRef);
        card.style.transition = 'all .3s ease';
        card.style.transform  = 'scale(.9)';
        card.style.opacity    = '0';
        setTimeout(() => { card.remove(); reloadFn(); }, 300);
        showToast('success', 'Deleted', `"${name}" has been removed.`);
      } catch (err) {
        console.error('[Vault] Delete failed:', err);
        showToast('error', 'Delete Failed', 'Could not remove this item.');
        setButtonLoading(deleteBtn, false);
      }
    });
  }

  // Visibility toggle
  const visCheckbox = card.querySelector('.vis-checkbox');
  if (visCheckbox) {
    visCheckbox.addEventListener('change', async (e) => {
      e.stopPropagation();
      const newVal = visCheckbox.checked;
      try {
        const pathParts = collectionPath.split('/');
        let docRef;
        if (pathParts.length === 1) {
          docRef = doc(db, pathParts[0], id);
        } else if (pathParts.length === 3) {
          docRef = doc(db, pathParts[0], pathParts[1], pathParts[2], id);
        }
        await updateDoc(docRef, { isPublic: newVal });

        // Update private badge
        const badge = card.querySelector('.card-private-badge');
        if (!newVal && !badge) {
          const b = document.createElement('span');
          b.className = 'card-private-badge';
          b.setAttribute('aria-label', 'Private');
          b.innerHTML = '<i class="fa-solid fa-lock" style="margin-right:3px"></i>Private';
          card.insertBefore(b, card.firstChild);
        } else if (newVal && badge) {
          badge.remove();
        }
        showToast('info', 'Visibility Updated', `"${name}" is now ${newVal ? 'Public' : 'Private'}.`);
      } catch (err) {
        console.error('[Vault] Visibility update failed:', err);
        showToast('error', 'Update Failed', 'Could not update visibility.');
        visCheckbox.checked = !newVal; // revert
      }
    });
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   ADD FILE (Container type = file)
   ══════════════════════════════════════════════════════════════════════════ */
addFileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = fileNameEl.value.trim();
  if (!name) {
    showFieldError('err-file-name', 'File name is required.', fileNameEl);
    return;
  }
  setButtonLoading(addFileBtn, true);
  try {
    await addDoc(collection(db, 'containers'), {
      name,
      description: fileDescEl.value.trim(),
      type:        'file',
      isPublic:    true,
      createdAt:   serverTimestamp(),
    });
    addFileForm.reset();
    showToast('success', 'File Created', `"${name}" has been added.`);
    renderContainers();
  } catch (err) {
    console.error('[Vault] Add file failed:', err);
    showToast('error', 'Failed', 'Could not create the File.');
  } finally {
    setButtonLoading(addFileBtn, false, '<i class="fa-solid fa-folder-plus"></i> Create File');
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ADD PROFILE (Container type = profile)
   ══════════════════════════════════════════════════════════════════════════ */
addProfileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = profileNameEl.value.trim();
  if (!name) {
    showFieldError('err-profile-name', 'Profile name is required.', profileNameEl);
    return;
  }
  setButtonLoading(addProfileBtn, true);
  try {
    await addDoc(collection(db, 'containers'), {
      name,
      description: profileDescEl.value.trim(),
      type:        'profile',
      isPublic:    true,
      createdAt:   serverTimestamp(),
    });
    addProfileForm.reset();
    showToast('success', 'Profile Created', `"${name}" has been added.`);
    renderContainers();
  } catch (err) {
    console.error('[Vault] Add profile failed:', err);
    showToast('error', 'Failed', 'Could not create the Profile.');
  } finally {
    setButtonLoading(addProfileBtn, false, '<i class="fa-solid fa-user-plus"></i> Create Profile');
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   ADD DIRECT CONTACT
   ══════════════════════════════════════════════════════════════════════════ */
addContactForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateFields([
    { el: contactNameEl,   errId: 'err-name',     msg: 'Full name is required.' },
    { el: contactPlatform, errId: 'err-platform',  msg: 'Please select a platform.' },
    { el: contactUrl,      errId: 'err-url',       msg: 'Profile URL is required.' },
  ])) return;

  setButtonLoading(addContactBtn, true);
  try {
    await addDoc(collection(db, 'contacts'), {
      name:       contactNameEl.value.trim(),
      platform:   contactPlatform.value,
      profileUrl: contactUrl.value.trim(),
      bio:        contactBio.value.trim(),
      birthday:   contactBirthday.value,
      isPublic:   true,
      createdAt:  serverTimestamp(),
    });
    addContactForm.reset();
    showToast('success', 'Contact Added', `${contactNameEl.value.trim() || 'Contact'} added to vault.`);
    renderContacts();
  } catch (err) {
    console.error('[Vault] Add contact failed:', err);
    showToast('error', 'Save Failed', 'Could not save the contact.');
  } finally {
    setButtonLoading(addContactBtn, false, '<i class="fa-solid fa-plus"></i> Add to Vault');
  }
});

// Clear validation on input
[contactNameEl, contactPlatform, contactUrl].forEach((el) => {
  el.addEventListener('input', () => {
    el.classList.remove('is-error');
    const errEl = document.getElementById(el.dataset.errTarget);
    if (errEl) errEl.classList.remove('visible');
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   ADD NESTED CONTACT (inside a container)
   ══════════════════════════════════════════════════════════════════════════ */
addNestedForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!validateFields([
    { el: nestedNameEl,     errId: 'err-nested-name',     msg: 'Full name is required.' },
    { el: nestedPlatformEl, errId: 'err-nested-platform',  msg: 'Please select a platform.' },
    { el: nestedUrlEl,      errId: 'err-nested-url',       msg: 'Profile URL is required.' },
  ])) return;

  setButtonLoading(addNestedBtn, true);
  try {
    await addDoc(collection(db, 'containers', currentContainerId, 'contacts'), {
      name:       nestedNameEl.value.trim(),
      platform:   nestedPlatformEl.value,
      profileUrl: nestedUrlEl.value.trim(),
      bio:        nestedBioEl.value.trim(),
      birthday:   nestedBirthdayEl.value,
      isPublic:   true,
      createdAt:  serverTimestamp(),
    });
    addNestedForm.reset();
    showToast('success', 'Contact Added', `${nestedNameEl.value.trim() || 'Contact'} added to collection.`);
    renderNestedContacts();
  } catch (err) {
    console.error('[Vault] Add nested contact failed:', err);
    showToast('error', 'Save Failed', 'Could not save contact. Check Firestore rules.');
  } finally {
    setButtonLoading(addNestedBtn, false, '<i class="fa-solid fa-plus"></i> Add Contact');
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   HEADER SCROLL EFFECT
   ══════════════════════════════════════════════════════════════════════════ */
const siteHeader = document.querySelector('.site-header');
window.addEventListener('scroll', () => {
  siteHeader.classList.toggle('scrolled', window.scrollY > 10);
}, { passive: true });

/* ══════════════════════════════════════════════════════════════════════════
   PAGE LOAD
   ══════════════════════════════════════════════════════════════════════════ */
window.addEventListener('load', () => {
  setTimeout(() => pageLoader.classList.add('hidden'), 400);
});

/* ══════════════════════════════════════════════════════════════════════════
   UTILITY FUNCTIONS
   ══════════════════════════════════════════════════════════════════════════ */

/** Validate multiple fields. Returns true if all pass. */
function validateFields(fields) {
  let valid = true;
  fields.forEach(({ el, errId, msg }) => {
    const errEl = document.getElementById(errId);
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

function showFieldError(errId, msg, el) {
  const errEl = document.getElementById(errId);
  if (errEl) { errEl.textContent = msg; errEl.classList.add('visible'); }
  el.classList.add('is-error');
}

function getSkeletonHTML(n) {
  return Array(n).fill('<div class="skeleton-card" aria-hidden="true"></div>').join('');
}

function getEmptyStateHTML(icon, text) {
  return `<div class="empty-state"><div class="empty-icon"><i class="${icon}" aria-hidden="true"></i></div><p class="empty-title">${text}</p></div>`;
}

function getErrorStateHTML() {
  return `<div class="empty-state"><div class="empty-icon"><i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i></div><h3 class="empty-title">Could not load data</h3><p class="empty-sub">Check Firebase config and Firestore rules.</p></div>`;
}

function escapeHTML(str) {
  const map = { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' };
  return String(str ?? '').replace(/[&<>"']/g, (m) => map[m]);
}

function formatDate(isoDate) {
  if (!isoDate) return '—';
  try {
    return new Date(isoDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return isoDate; }
}

function setButtonLoading(btn, loading, html = '') {
  btn.disabled = loading;
  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" aria-hidden="true"></i> Please wait…';
  } else {
    btn.innerHTML = html || btn.dataset.originalHtml || btn.innerHTML;
  }
}

function getFriendlyAuthError(code) {
  const map = {
    'auth/user-not-found':       'No account found with this email.',
    'auth/wrong-password':       'Incorrect password. Please try again.',
    'auth/invalid-email':        'Please enter a valid email address.',
    'auth/too-many-requests':    'Too many attempts. Try again later.',
    'auth/network-request-failed':'Network error. Check your connection.',
    'auth/invalid-credential':   'Invalid credentials. Check email and password.',
  };
  return map[code] || 'Authentication failed. Please try again.';
}

function showToast(type, title, message, duration = 4000) {
  const container = document.getElementById('toast-container');
  const icons = { success:'fa-solid fa-circle-check', error:'fa-solid fa-circle-exclamation', info:'fa-solid fa-circle-info' };
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="toast-icon"><i class="${icons[type]}" aria-hidden="true"></i></div>
    <div class="toast-body">
      <p class="toast-title">${escapeHTML(title)}</p>
      <p class="toast-message">${escapeHTML(message)}</p>
    </div>
    <button style="margin-left:auto;border:none;background:none;color:#64748b;font-size:.9rem;cursor:pointer;flex-shrink:0;padding:.25rem;" aria-label="Dismiss">
      <i class="fa-solid fa-xmark"></i>
    </button>
  `;
  const dismiss = () => { toast.classList.add('exit'); setTimeout(() => toast.remove(), 300); };
  toast.querySelector('button').addEventListener('click', dismiss);
  container.appendChild(toast);
  setTimeout(dismiss, duration);
}
