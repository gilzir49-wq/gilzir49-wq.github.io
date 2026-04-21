/* ===== Cloud Sync — Firebase Firestore ===== */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAC6oiLElA2CbosGkUDM5rJsq7q3DuMzpM",
  authDomain: "command-center-gal.firebaseapp.com",
  projectId: "command-center-gal",
  storageBucket: "command-center-gal.firebasestorage.app",
  messagingSenderId: "982162335406",
  appId: "1:982162335406:web:8cbdfc8ef332fcd2742f3f"
};

let _db = null;
let _wsCode = null;
let _unsubscribers = [];

// ── Workspace code ─────────────────────────────────────
function getWsCode() {
  if (_wsCode) return _wsCode;
  let code = localStorage.getItem('_wsCode');
  if (!code) {
    const r = () => Math.random().toString(36).slice(2, 5).toUpperCase();
    code = r() + '-' + r();
    localStorage.setItem('_wsCode', code);
  }
  _wsCode = code;
  return code;
}

// ── Init Firebase ──────────────────────────────────────
function initCloud() {
  try {
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_CONFIG);
    _db = firebase.firestore();
    // Offline persistence — data survives no-internet
    _db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    startListeners();
    updateSyncIcon('🟢');
  } catch (e) {
    console.warn('Firebase init failed — offline mode', e);
    updateSyncIcon('🟡');
  }
}

// ── Collection ref under workspace ────────────────────
function colRef(col) {
  return _db.collection('workspaces').doc(getWsCode()).collection(col);
}

// ── Write item to Firestore ────────────────────────────
function cloudWrite(col, item) {
  if (!_db || !item?.id) return;
  colRef(col).doc(item.id).set(item, { merge: true }).catch(console.error);
}

// ── Delete item from Firestore ─────────────────────────
function cloudDelete(col, id) {
  if (!_db) return;
  colRef(col).doc(id).delete().catch(console.error);
}

// ── Patch DB methods ───────────────────────────────────
const _rawSet    = DB.set.bind(DB);
const _rawAdd    = DB.add.bind(DB);
const _rawUpdate = DB.update.bind(DB);
const _rawRemove = DB.remove.bind(DB);
const _rawToggle = DB.toggle.bind(DB);

DB.add = function(key, item) {
  const result = _rawAdd(key, item);
  cloudWrite(key, result);
  return result;
};

DB.update = function(key, id, patch) {
  const result = _rawUpdate(key, id, patch);
  if (result) cloudWrite(key, result);
  return result;
};

DB.remove = function(key, id) {
  _rawRemove(key, id);
  cloudDelete(key, id);
};

DB.toggle = function(key, id, field = 'done') {
  _rawToggle(key, id, field);
  const item = DB.get(key).find(x => x.id === id);
  if (item) cloudWrite(key, item);
};

DB.set = function(key, val) {
  _rawSet(key, val);
  if (!_db) return;
  if (Array.isArray(val)) {
    val.forEach(item => { if (item?.id) cloudWrite(key, item); });
  }
};

// ── Real-time listeners ────────────────────────────────
const SYNC_COLS = ['tasks', 'finance', 'leads', 'calm_log'];

function startListeners() {
  // Unsubscribe old listeners
  _unsubscribers.forEach(fn => fn());
  _unsubscribers = [];

  SYNC_COLS.forEach(col => {
    const unsub = colRef(col).onSnapshot(snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'removed') {
          _rawSet(col, DB.get(col).filter(x => x.id !== change.doc.id));
          return;
        }
        const item = change.doc.data();
        if (!item?.id) return;
        const local = DB.get(col);
        const idx = local.findIndex(x => x.id === item.id);
        if (idx === -1) local.unshift(item);
        else local[idx] = { ...local[idx], ...item };
        local.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        _rawSet(col, local);
      });
      clearTimeout(window._rdTimer);
      window._rdTimer = setTimeout(() => {
        if (typeof renderPage === 'function' && typeof State !== 'undefined') {
          renderPage(State.page);
        }
      }, 350);
    }, err => {
      console.warn('Firestore listener error:', err);
      updateSyncIcon('🟡');
    });
    _unsubscribers.push(unsub);
  });
}

// ── Upload existing local data to Firestore ────────────
function uploadLocalData() {
  SYNC_COLS.forEach(col => {
    const items = DB.get(col);
    items.forEach(item => { if (item?.id) cloudWrite(col, item); });
  });
}

// ── Online / offline ───────────────────────────────────
window.addEventListener('online',  () => { updateSyncIcon('🟢'); if (!_db) initCloud(); });
window.addEventListener('offline', () => updateSyncIcon('🟡'));

function updateSyncIcon(icon) {
  const el = document.getElementById('sync-status');
  if (el) el.textContent = icon;
}

// ── Workspace modal ────────────────────────────────────
function showWorkspaceInfo() {
  const code = getWsCode();
  openModal(`
    <div class="modal-title">☁️ סנכרון ושיתוף</div>
    <p style="font-size:14px;color:var(--text-3);margin-bottom:14px">
      שתף את הקוד עם מישהו שרוצה גישה לאותם נתונים — כל שינוי יסתנכרן מיידית.
    </p>
    <div style="text-align:center;font-size:32px;font-weight:900;letter-spacing:8px;
      padding:20px;background:var(--bg);border-radius:16px;margin-bottom:14px;
      font-family:monospace">${code}</div>
    <button class="btn-primary" style="margin-bottom:10px" onclick="copyWsCode()">📋 העתק קוד</button>
    <button class="btn-secondary" style="margin-bottom:10px" onclick="uploadLocalData();showToast('✅ נתונים הועלו לענן!')">☁️ העלה נתונים קיימים לענן</button>

    <div class="divider"></div>
    <div style="font-size:14px;font-weight:600;margin-bottom:8px">הצטרף לסביבה אחרת</div>
    <input class="form-input" id="join-code-input" placeholder="XXX-XXX"
      style="text-align:center;font-size:22px;letter-spacing:6px;font-family:monospace"
      maxlength="7" dir="ltr">
    <button class="btn-primary" style="--btn-color:var(--c-brain);margin-top:10px"
      onclick="joinWorkspace()">🔗 הצטרף</button>

    <div style="margin-top:14px;padding:12px;background:var(--bg);border-radius:12px;
      font-size:12px;color:var(--text-3)">
      🔥 מחובר ל-Firebase · הנתונים שמורים בענן של Google לצמיתות
    </div>
  `);
}

function copyWsCode() {
  const code = getWsCode();
  (navigator.clipboard?.writeText(code) || Promise.reject())
    .then(() => showToast('📋 קוד הועתק!'))
    .catch(() => showToast('הקוד שלך: ' + code));
}

function joinWorkspace() {
  const raw = document.getElementById('join-code-input')?.value?.trim().toUpperCase();
  if (!raw || raw.length < 5) { showToast('קוד לא תקין'); return; }
  if (!confirm(`להצטרף לסביבה "${raw}"?`)) return;
  _wsCode = raw;
  localStorage.setItem('_wsCode', raw);
  closeModal();
  startListeners();
  showToast('✅ מחובר לסביבה ' + raw);
  setTimeout(() => { if (typeof renderPage === 'function') renderPage(State.page); }, 800);
}

function openCloudSetup() { showWorkspaceInfo(); }

// ── Boot ──────────────────────────────────────────────
initCloud();
