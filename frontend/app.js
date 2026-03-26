// ============================================================
// PRINTSHOP CAMPUS - Main Application JS
// ============================================================
// ✅ Firebase imports (must be at top)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// ✅ Your Firebase config (already correct)
const firebaseConfig = {
  apiKey: "AIzaSyB-uJjPZF7cQfug1ZB4_QswypVuSTHgW74",
  authDomain: "newapp-7e40c.firebaseapp.com",
  projectId: "newapp-7e40c",
  storageBucket: "newapp-7e40c.firebasestorage.app",
  messagingSenderId: "795923502572",
  appId: "1:795923502572:web:ed9db237947ae22b6adcc9",
  measurementId: "G-G41PYF00F3"
};

// ✅ Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

let currentUser = null;
let allPolls = [];
let allPayments = [];
let allNotifications = [];
let deferredInstallPrompt = null;
let revenueChart = null;
let statusChart = null;
let countdownTimers = {};
let activeFilter = 'all';
let currentPollForPayment = null;

// ============================================================
// PWA INSTALL
// ============================================================
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstallPrompt = e;
  document.getElementById('installBanner').classList.remove('hidden');
});
async function installApp() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  if (outcome === 'accepted') { toast('App installed successfully! 🎉', 'success'); }
  dismissInstall();
}
function dismissInstall() {
  document.getElementById('installBanner').classList.add('hidden');
  deferredInstallPrompt = null;
}

// Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {});
  });
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function toast(msg, type = 'info') {
  const t = document.getElementById('toast');
  const icon = document.getElementById('toastIcon');
  const msgEl = document.getElementById('toastMsg');
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  icon.textContent = icons[type] || 'ℹ️';
  msgEl.textContent = msg;
  t.style.borderColor = type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : type === 'warning' ? '#f59e0b' : 'rgba(255,255,255,0.1)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ============================================================
// DARK MODE
// ============================================================
function toggleDark() {
  const html = document.documentElement;
  html.classList.toggle('dark');
  const isDark = html.classList.contains('dark');
  document.getElementById('darkBtn').textContent = isDark ? '🌙' : '☀️';
  const toggle = document.getElementById('darkToggle');
  if (toggle) { isDark ? toggle.classList.add('on') : toggle.classList.remove('on'); }
  localStorage.setItem('darkMode', isDark);
}
function initDarkMode() {
  const saved = localStorage.getItem('darkMode');
  if (saved === 'false') {
    document.documentElement.classList.remove('dark');
    document.getElementById('darkBtn').textContent = '☀️';
  } else {
    document.documentElement.classList.add('dark');
    const t = document.getElementById('darkToggle');
    if (t) t.classList.add('on');
  }
}

// ============================================================
// AUTH
// ============================================================
function switchAuthTab(tab) {
  const loginForm = document.getElementById('loginForm');
  const signupForm = document.getElementById('signupForm');
  const loginTab = document.getElementById('loginTab');
  const signupTab = document.getElementById('signupTab');
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginTab.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
    loginTab.style.color = 'white';
    signupTab.style.background = 'transparent';
    signupTab.style.color = '#94a3b8';
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    signupTab.style.background = 'linear-gradient(135deg,#6366f1,#4f46e5)';
    signupTab.style.color = 'white';
    loginTab.style.background = 'transparent';
    loginTab.style.color = '#94a3b8';
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById('loginBtn');
  btn.textContent = '⏳ Signing in...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: document.getElementById('loginEmail').value, password: document.getElementById('loginPassword').value }),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    currentUser = data.user;
    onLogin();
    toast(`Welcome back, ${currentUser.name}! 👋`, 'success');
  } catch (err) {
    toast(err.message || 'Login failed', 'error');
  } finally {
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

async function handleSignup(e) {
  e.preventDefault();
  const btn = document.getElementById('signupBtn');
  btn.textContent = '⏳ Creating account...';
  btn.disabled = true;
  try {
    const res = await fetch('/api/signup', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: document.getElementById('signupName').value,
        email: document.getElementById('signupEmail').value,
        password: document.getElementById('signupPassword').value,
        role: document.getElementById('signupRole').value
      }),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    currentUser = data.user;
    onLogin();
    toast(`Welcome to PrintShop, ${currentUser.name}! 🎉`, 'success');
  } catch (err) {
    toast(err.message || 'Signup failed', 'error');
  } finally {
    btn.textContent = 'Create Account';
    btn.disabled = false;
  }
}

// Google Login (simulated with demo modal)
async function handleGoogleLogin() {
  try {
    console.log("Google login clicked"); // 🔍 debug

    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log("User:", user);

    // Send to backend
    const res = await fetch('/api/google-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: user.displayName,
        email: user.email,
        googleId: user.uid
      }),
      credentials: 'include'
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error);

    currentUser = data.user;
    onLogin();

    alert("Welcome " + user.displayName);

  } catch (error) {
    console.error("Google Error:", error);
    alert("Error: " + error.message);
  }
}

window.handleGoogleLogin = handleGoogleLogin;

async function handleLogout() {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    currentUser = null;
    clearCountdowns();
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appScreen').classList.add('hidden');
    toast('Logged out successfully', 'info');
  } catch (e) {
    toast('Logout failed', 'error');
  }
}

function togglePwd(id, btn) {
  const inp = document.getElementById(id);
  inp.type = inp.type === 'password' ? 'text' : 'password';
  btn.textContent = inp.type === 'password' ? '👁' : '🙈';
}

// ============================================================
// APP INIT
// ============================================================
function onLogin() {
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appScreen').classList.remove('hidden');
  updateUserUI();
  showPage('home');
  loadHomeData();
  checkNotifications();
}

function updateUserUI() {
  if (!currentUser) return;
  const initial = currentUser.name.charAt(0).toUpperCase();
  document.getElementById('userAvatar').textContent = initial;
  document.getElementById('greetName').textContent = currentUser.name.split(' ')[0];
  document.getElementById('roleTag').textContent = currentUser.role === 'cr' ? '👑 CR' : '🎓 Student';
  document.getElementById('profileAvatar').textContent = initial;
  document.getElementById('profileName').textContent = currentUser.name;
  document.getElementById('profileEmail').textContent = currentUser.email;
  document.getElementById('profileRole').textContent = currentUser.role === 'cr' ? '👑 Class Representative' : '🎓 Student';

  // Nav labels for CR
  if (currentUser.role === 'cr') {
    document.getElementById('nav-polls-label').textContent = 'Create';
    document.getElementById('nav-polls').setAttribute('onclick', "showPage('create')");
  }
}

// ============================================================
// PAGE NAVIGATION
// ============================================================
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) { pageEl.classList.add('active'); pageEl.classList.remove('fade-up'); void pageEl.offsetWidth; pageEl.classList.add('fade-up'); }
  const navEl = document.getElementById(`nav-${page}`);
  if (navEl) navEl.classList.add('active');

  // Load page data
  if (page === 'home') loadHomeData();
  else if (page === 'polls' || page === 'create') { if (currentUser?.role === 'cr') { document.getElementById('page-create')?.classList.add('active'); document.getElementById('nav-polls')?.classList.add('active'); } else loadPolls(); }
  else if (page === 'dashboard') loadDashboard();
  else if (page === 'payments') loadPaymentsPage();
  else if (page === 'profile') loadProfile();
  else if (page === 'notifications') renderNotifications();
}

// ============================================================
// HOME DATA
// ============================================================
async function loadHomeData() {
  await loadPolls();
  if (currentUser?.role === 'cr') renderCRHomeStats();
  else renderStudentHomeStats();
}

async function renderStudentHomeStats() {
  const payments = await fetchMyPayments();
  const activeCount = allPolls.filter(p => p.status === 'active').length;
  const paidCount = payments.filter(p => p.status === 'verified').length;
  document.getElementById('homeStats').innerHTML = `
    <div class="card p-4 rounded-2xl">
      <div class="text-2xl font-bold grad">${activeCount}</div>
      <div class="text-xs text-slate-400 mt-1">Active Polls</div>
    </div>
    <div class="card p-4 rounded-2xl">
      <div class="text-2xl font-bold" style="color:#4ade80">${paidCount}</div>
      <div class="text-xs text-slate-400 mt-1">Verified Payments</div>
    </div>
  `;
}

async function renderCRHomeStats() {
  const dashRes = await fetch('/api/dashboard', { credentials: 'include' });
  const dash = await dashRes.json();
  document.getElementById('homeStats').innerHTML = `
    <div class="card p-4 rounded-2xl">
      <div class="text-2xl font-bold grad">₹${(dash.totalRevenue||0).toFixed(0)}</div>
      <div class="text-xs text-slate-400 mt-1">Total Revenue</div>
    </div>
    <div class="card p-4 rounded-2xl">
      <div class="text-2xl font-bold" style="color:#f87171">${dash.suspicious||0}</div>
      <div class="text-xs text-slate-400 mt-1">Suspicious</div>
    </div>
  `;
}

// ============================================================
// POLLS
// ============================================================
async function loadPolls() {
  try {
    const res = await fetch('/api/polls', { credentials: 'include' });
    allPolls = await res.json();
    renderPollsList('pollsList');
    renderPollsList('pollsPageList');
    if (currentUser?.role === 'cr') renderCRPolls();
  } catch (e) {
    document.getElementById('pollsList').innerHTML = '<div class="card p-4 text-center text-slate-400 rounded-2xl">Failed to load polls</div>';
  }
}

function renderPollsList(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const active = allPolls.filter(p => p.status === 'active');
  if (!active.length) {
    container.innerHTML = '<div class="card p-8 text-center rounded-2xl"><div class="text-4xl mb-2">📋</div><p class="text-slate-400">No active polls right now</p></div>';
    return;
  }
  container.innerHTML = active.map(poll => renderPollCard(poll)).join('');
  startCountdowns(active);
}

function renderPollCard(poll) {
  const joined = poll.participants?.find(p => p.userId === currentUser?.id);
  const expiryMs = new Date(poll.expiryTime) - new Date();
  const expired = expiryMs <= 0;
  const participantCount = poll.participants?.length || 0;
  const estimatedWait = participantCount * 2;
  return `
  <div class="card rounded-2xl overflow-hidden cursor-pointer fade-up" onclick="openPollModal('${poll.id}')">
    <div class="p-4">
      <div class="flex items-start justify-between gap-2 mb-3">
        <div>
          <h3 class="font-bold text-base">${escHtml(poll.subject)}</h3>
          ${poll.description ? `<p class="text-slate-400 text-xs mt-0.5">${escHtml(poll.description)}</p>` : ''}
        </div>
        <div class="text-right flex-shrink-0">
          <div class="font-bold text-lg" style="color:#a5b4fc">₹${poll.pricePerCopy}</div>
          <div class="text-xs text-slate-400">per copy</div>
        </div>
      </div>
      <div class="flex items-center gap-3 text-xs text-slate-400 mb-3">
        <span>👥 ${participantCount} joined</span>
        ${poll.totalPages ? `<span>📄 ${poll.totalPages} pages</span>` : ''}
        <span>⏱ ~${estimatedWait}m wait</span>
      </div>
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          ${expired ? '<span class="badge" style="background:rgba(239,68,68,0.15);color:#f87171;border:1px solid rgba(239,68,68,0.3)">Expired</span>' : `<span class="text-xs font-mono font-bold" style="color:#6366f1" id="countdown-${poll.id}">--:--:--</span>`}
        </div>
        ${joined ? `<span class="badge status-verified">✓ Joined • Q${joined.queuePosition || '?'}</span>` :
          expired ? '<span class="text-xs text-slate-500">Closed</span>' :
          '<span class="text-xs font-semibold" style="color:#6366f1">Tap to join →</span>'}
      </div>
    </div>
    ${poll.qrImage ? `<div class="h-1 w-full" style="background:linear-gradient(90deg,#6366f1,#a78bfa)"></div>` : ''}
  </div>`;
}

function renderCRPolls() {
  const container = document.getElementById('crPollsList');
  if (!container) return;
  if (!allPolls.length) { container.innerHTML = '<div class="card p-4 text-center text-slate-400 rounded-2xl">No polls created yet</div>'; return; }
  container.innerHTML = allPolls.slice().reverse().map(poll => `
    <div class="card rounded-2xl p-4 cursor-pointer" onclick="openPollModal('${poll.id}')">
      <div class="flex justify-between items-start">
        <div>
          <h3 class="font-semibold">${escHtml(poll.subject)}</h3>
          <p class="text-xs text-slate-400 mt-0.5">${poll.participants?.length || 0} participants • ₹${poll.pricePerCopy}/copy</p>
        </div>
        <span class="badge ${poll.status === 'active' ? 'status-verified' : poll.status === 'expired' ? 'status-suspicious' : 'status-rejected'} text-xs">${poll.status}</span>
      </div>
      <div class="flex gap-2 mt-3">
        <button onclick="event.stopPropagation();openPaymentsForPoll('${poll.id}')" class="btn-secondary text-xs px-3 py-1.5 rounded-lg">💳 Payments</button>
        ${poll.status === 'active' ? `<button onclick="event.stopPropagation();closePoll('${poll.id}')" class="btn-danger text-xs px-3 py-1.5 rounded-lg">Close Poll</button>` : ''}
        <button onclick="event.stopPropagation();viewReport('${poll.id}')" class="btn-secondary text-xs px-3 py-1.5 rounded-lg">📊 Report</button>
      </div>
    </div>
  `).join('');
}

// ============================================================
// POLL MODAL
// ============================================================
function openPollModal(pollId) {
  const poll = allPolls.find(p => p.id === pollId);
  if (!poll) return;
  const joined = poll.participants?.find(p => p.userId === currentUser?.id);
  const isExpired = new Date(poll.expiryTime) < new Date() || poll.status !== 'active';
  const isCR = currentUser?.role === 'cr';

  document.getElementById('pollModalContent').innerHTML = `
    <div class="flex items-center gap-2 mb-5">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#6366f1,#4f46e5)">
        <span class="text-white text-lg">📄</span>
      </div>
      <div>
        <h2 class="font-bold text-lg">${escHtml(poll.subject)}</h2>
        <p class="text-slate-400 text-xs">${poll.totalPages ? poll.totalPages + ' pages • ' : ''}₹${poll.pricePerCopy}/copy</p>
      </div>
      <button onclick="closePollModal()" class="ml-auto text-slate-400 text-2xl leading-none">×</button>
    </div>
    ${poll.description ? `<p class="text-slate-400 text-sm mb-4 p-3 rounded-xl" style="background:rgba(255,255,255,0.04)">${escHtml(poll.description)}</p>` : ''}

    <!-- Stats -->
    <div class="grid grid-cols-3 gap-2 mb-4">
      <div class="card p-3 rounded-xl text-center">
        <div class="font-bold text-lg">${poll.participants?.length || 0}</div>
        <div class="text-xs text-slate-400">Joined</div>
      </div>
      <div class="card p-3 rounded-xl text-center">
        <div class="font-bold text-lg">~${(poll.participants?.length || 0) * 2}m</div>
        <div class="text-xs text-slate-400">Est. Wait</div>
      </div>
      <div class="card p-3 rounded-xl text-center">
        <div class="font-bold text-lg" style="color:#a5b4fc">₹${poll.pricePerCopy}</div>
        <div class="text-xs text-slate-400">/copy</div>
      </div>
    </div>

    <!-- Expiry -->
    ${!isExpired ? `<div class="p-3 rounded-xl mb-4 flex items-center gap-3" style="background:rgba(99,102,241,0.1)">
      <span class="text-xl">⏰</span>
      <div><p class="text-xs text-slate-400">Expires in</p><p class="font-mono font-bold" id="modalCountdown-${poll.id}">--:--:--</p></div>
    </div>` : ''}

    <!-- QR Code -->
    ${poll.qrImage ? `<div class="mb-4"><p class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">UPI QR Code</p><img src="${poll.qrImage}" class="max-h-48 mx-auto rounded-xl border border-slate-700"/></div>` : ''}

    <!-- Actions -->
    ${!isCR ? `
      ${joined ? `
        <div class="p-3 rounded-xl mb-3 flex items-center gap-3" style="background:rgba(34,197,94,0.1)">
          <span class="text-xl">✅</span>
          <div><p class="font-semibold text-sm" style="color:#4ade80">You're in Queue #${joined.queuePosition || '?'}</p><p class="text-xs text-slate-400">Payment: ${joined.paymentStatus || 'pending'}</p></div>
        </div>
        ${joined.paymentStatus === 'pending' || !joined.paymentId ? `<button onclick="closePollModal();openPaymentModal('${poll.id}')" class="btn-primary">💳 Submit Payment</button>` : ''}
      ` : !isExpired ? `
        <div class="mb-3">
          <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Number of Copies</label>
          <input type="number" id="joinCopies" value="1" min="1" max="20" class="inp"/>
        </div>
        <button onclick="joinPoll('${poll.id}')" class="btn-primary">🖨️ Join Poll</button>
      ` : '<p class="text-center text-slate-400 py-4">This poll has expired</p>'}
    ` : `<div class="flex gap-3">
      <button onclick="closePollModal();openPaymentsForPoll('${poll.id}')" class="btn-primary flex-1">💳 View Payments</button>
      ${poll.status === 'active' ? `<button onclick="closePoll('${poll.id}')" class="btn-danger">Close</button>` : ''}
    </div>`}
  `;
  document.getElementById('pollModal').classList.add('open');
  if (!isExpired) {
    const el = document.getElementById(`modalCountdown-${poll.id}`);
    if (el) startSingleCountdown(poll.id, poll.expiryTime, el);
  }
}
function closePollModal(e) {
  if (e && e.target !== document.getElementById('pollModal')) return;
  document.getElementById('pollModal').classList.remove('open');
}

// ============================================================
// JOIN POLL
// ============================================================
async function joinPoll(pollId) {
  const copies = parseInt(document.getElementById('joinCopies')?.value) || 1;
  try {
    const res = await fetch('/api/join-poll', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pollId, copies }),
      credentials: 'include'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(`Joined! You're #${data.queuePosition} in queue 🎉`, 'success');
    document.getElementById('pollModal').classList.remove('open');
    addNotification({ title: 'Joined Poll', message: `Queue position: #${data.queuePosition}`, type: 'success', time: new Date() });
    await loadPolls();
    openPaymentModal(pollId);
  } catch (e) {
    toast(e.message || 'Failed to join', 'error');
  }
}

// ============================================================
// PAYMENT MODAL (Student submits payment)
// ============================================================
function openPaymentModal(pollId) {
  const poll = allPolls.find(p => p.id === pollId);
  if (!poll) return;
  currentPollForPayment = poll;
  const participant = poll.participants?.find(p => p.userId === currentUser?.id);
  const copies = participant?.copies || 1;
  const totalAmount = poll.pricePerCopy * copies;

  document.getElementById('paymentModalContent').innerHTML = `
    <div class="flex items-center gap-2 mb-5">
      <div class="w-10 h-10 rounded-xl flex items-center justify-center" style="background:linear-gradient(135deg,#22c55e,#16a34a)">
        <span class="text-white text-lg">💳</span>
      </div>
      <div>
        <h2 class="font-bold text-lg">Submit Payment</h2>
        <p class="text-slate-400 text-xs">${escHtml(poll.subject)}</p>
      </div>
      <button onclick="closePaymentModal()" class="ml-auto text-slate-400 text-2xl leading-none">×</button>
    </div>

    <!-- Amount -->
    <div class="p-4 rounded-xl mb-5 text-center" style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(167,139,250,0.1))">
      <p class="text-slate-400 text-xs mb-1">Amount to Pay</p>
      <p class="text-4xl font-bold grad">₹${totalAmount.toFixed(2)}</p>
      <p class="text-xs text-slate-400 mt-1">${copies} copy × ₹${poll.pricePerCopy}</p>
    </div>

    <!-- QR Code -->
    ${poll.qrImage ? `
    <div class="mb-5">
      <p class="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">Scan to Pay</p>
      <img src="${poll.qrImage}" class="max-h-48 mx-auto rounded-xl border border-slate-700"/>
    </div>` : `
    <div class="p-3 rounded-xl mb-5 text-center text-slate-400 border border-dashed border-slate-600">
      <p class="text-sm">Pay ₹${totalAmount.toFixed(2)} to your CR via UPI</p>
    </div>`}

    <!-- Transaction ID -->
    <form onsubmit="submitPayment(event,'${pollId}')" class="space-y-4">
      <div>
        <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Transaction ID *</label>
        <input type="text" id="txnId" class="inp font-mono" placeholder="e.g. TXN123456789" required minlength="8" maxlength="64"/>
        <p class="text-xs text-slate-500 mt-1">Copy from your UPI app after payment</p>
      </div>
      <div>
        <label class="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Payment Screenshot <span class="text-slate-500">(recommended)</span></label>
        <div class="border-2 border-dashed border-slate-600 rounded-xl p-4 text-center cursor-pointer hover:border-indigo-500 transition-colors" onclick="document.getElementById('screenshotUpload').click()">
          <div id="ssPreviewDiv" class="hidden">
            <img id="ssPreviewImg" class="max-h-32 mx-auto rounded-lg mb-1"/>
            <p class="text-xs text-slate-400">Tap to change</p>
          </div>
          <div id="ssPlaceholder">
            <p class="text-2xl mb-1">📸</p>
            <p class="text-sm text-slate-400">Upload screenshot</p>
          </div>
        </div>
        <input type="file" id="screenshotUpload" accept="image/*" class="hidden" onchange="previewScreenshot(this)"/>
      </div>
      <div class="p-3 rounded-xl text-xs text-slate-400" style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2)">
        ⚠️ Submitting a false transaction ID is considered fraud and may result in account suspension.
      </div>
      <button type="submit" class="btn-primary" id="paymentSubmitBtn">✅ Submit Payment</button>
    </form>
  `;
  document.getElementById('paymentModal').classList.add('open');
}
function closePaymentModal(e) {
  if (e && e.target !== document.getElementById('paymentModal')) return;
  document.getElementById('paymentModal').classList.remove('open');
}
function previewScreenshot(input) {
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('ssPreviewImg').src = e.target.result;
      document.getElementById('ssPreviewDiv').classList.remove('hidden');
      document.getElementById('ssPlaceholder').classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}
async function submitPayment(e, pollId) {
  e.preventDefault();
  const btn = document.getElementById('paymentSubmitBtn');
  btn.textContent = '⏳ Submitting...';
  btn.disabled = true;

  const txnId = document.getElementById('txnId').value.trim();
  // Client-side validation
  if (!/^[a-zA-Z0-9_\-]{8,64}$/.test(txnId)) {
    toast('Invalid transaction ID (8-64 alphanumeric characters)', 'error');
    btn.textContent = '✅ Submit Payment'; btn.disabled = false; return;
  }

  const formData = new FormData();
  formData.append('pollId', pollId);
  formData.append('transactionId', txnId);
  const poll = allPolls.find(p => p.id === pollId);
  const participant = poll?.participants?.find(p => p.userId === currentUser?.id);
  formData.append('copies', participant?.copies || 1);
  const screenshot = document.getElementById('screenshotUpload')?.files?.[0];
  if (screenshot) formData.append('screenshot', screenshot);

  try {
    const res = await fetch('/api/submit-payment', { method: 'POST', body: formData, credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const statusMessages = {
      fraud: '🚫 Fraud detected: Duplicate transaction ID!',
      suspicious: '⚠️ Payment submitted but flagged as suspicious',
      pending: '✅ Payment submitted! Awaiting CR approval'
    };
    const statusTypes = { fraud: 'error', suspicious: 'warning', pending: 'success' };
    toast(statusMessages[data.payment?.status] || '✅ Payment submitted!', statusTypes[data.payment?.status] || 'success');
    document.getElementById('paymentModal').classList.remove('open');
    addNotification({ title: 'Payment Submitted', message: `Status: ${data.payment?.status}`, type: statusTypes[data.payment?.status] || 'info', time: new Date() });
    await loadPolls();
  } catch (err) {
    toast(err.message || 'Payment submission failed', 'error');
  } finally {
    btn.textContent = '✅ Submit Payment'; btn.disabled = false;
  }
}

// ============================================================
// CREATE POLL
// ============================================================
function setDuration(mins) {
  document.getElementById('pollDuration').value = mins;
  document.querySelectorAll('.duration-btn').forEach(b => {
    b.style.background = '';
    b.style.color = '';
  });
}
function previewQR(input) {
  if (input.files?.[0]) {
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('qrPreviewImg').src = e.target.result;
      document.getElementById('qrPreview').classList.remove('hidden');
      document.getElementById('qrPlaceholder').classList.add('hidden');
    };
    reader.readAsDataURL(input.files[0]);
  }
}
async function handleCreatePoll(e) {
  e.preventDefault();
  const btn = document.getElementById('createPollBtn');
  btn.textContent = '⏳ Creating...';
  btn.disabled = true;
  const formData = new FormData();
  formData.append('subject', document.getElementById('pollSubject').value);
  formData.append('pricePerCopy', document.getElementById('pollPrice').value);
  formData.append('expiryMinutes', document.getElementById('pollDuration').value);
  formData.append('totalPages', document.getElementById('pollPages').value || '0');
  formData.append('description', document.getElementById('pollDesc').value);
  const qrFile = document.getElementById('qrUpload')?.files?.[0];
  if (qrFile) formData.append('qrImage', qrFile);
  try {
    const res = await fetch('/api/create-poll', { method: 'POST', body: formData, credentials: 'include' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    toast(`Poll created for "${data.poll.subject}" 🎉`, 'success');
    document.getElementById('createPollForm').reset();
    document.getElementById('qrPreview').classList.add('hidden');
    document.getElementById('qrPlaceholder').classList.remove('hidden');
    addNotification({ title: 'Poll Created', message: `"${data.poll.subject}" is now live`, type: 'success', time: new Date() });
    await loadPolls();
    showPage('dashboard');
  } catch (err) {
    toast(err.message || 'Failed to create poll', 'error');
  } finally {
    btn.textContent = '🚀 Create Poll'; btn.disabled = false;
  }
}

// ============================================================
// CR DASHBOARD
// ============================================================
async function loadDashboard() {
  try {
    const res = await fetch('/api/dashboard', { credentials: 'include' });
    const dash = await res.json();
    renderDashStats(dash);
    renderCharts(dash);
    await loadPolls();
  } catch (e) { toast('Failed to load dashboard', 'error'); }
}

function renderDashStats(dash) {
  const stats = [
    { label: 'Total Revenue', value: `₹${(dash.totalRevenue||0).toFixed(0)}`, color: '#a5b4fc', icon: '💰' },
    { label: 'Active Polls', value: dash.activePolls || 0, color: '#4ade80', icon: '📋' },
    { label: 'Verified', value: dash.verified || 0, color: '#4ade80', icon: '✅' },
    { label: 'Suspicious', value: dash.suspicious || 0, color: '#fb923c', icon: '⚠️' }
  ];
  document.getElementById('dashStats').innerHTML = stats.map(s => `
    <div class="card p-4 rounded-2xl">
      <div class="flex items-center gap-2 mb-1">
        <span class="text-lg">${s.icon}</span>
        <span class="text-xs text-slate-400">${s.label}</span>
      </div>
      <div class="text-2xl font-bold" style="color:${s.color}">${s.value}</div>
    </div>`).join('');
}

function renderCharts(dash) {
  // Revenue chart
  const revenueCtx = document.getElementById('revenueChart')?.getContext('2d');
  if (revenueCtx) {
    if (revenueChart) revenueChart.destroy();
    const labels = (dash.recentPolls || []).map(p => p.subject?.slice(0,15) + (p.subject?.length > 15 ? '…' : ''));
    revenueChart = new Chart(revenueCtx, {
      type: 'bar',
      data: {
        labels: labels.length ? labels : ['No polls yet'],
        datasets: [{ label: 'Revenue (₹)', data: labels.length ? new Array(labels.length).fill(0) : [0], backgroundColor: 'rgba(99,102,241,0.6)', borderColor: '#6366f1', borderWidth: 2, borderRadius: 8 }]
      },
      options: { responsive: true, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }, y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } } } }
    });
  }

  // Status doughnut
  const statusCtx = document.getElementById('statusChart')?.getContext('2d');
  if (statusCtx) {
    if (statusChart) statusChart.destroy();
    statusChart = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Verified', 'Pending', 'Suspicious', 'Rejected'],
        datasets: [{ data: [dash.verified||0, (dash.totalPayments||0)-(dash.verified||0)-(dash.suspicious||0), dash.suspicious||0, 0], backgroundColor: ['#22c55e','#eab308','#f97316','#6b7280'], borderWidth: 0, hoverOffset: 8 }]
      },
      options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8', font: { size: 11 }, padding: 12 } } }, cutout: '65%' }
    });
  }
}

// ============================================================
// PAYMENTS PAGE (CR)
// ============================================================
async function loadPaymentsPage() {
  if (currentUser?.role !== 'cr') { renderMyPaymentsPage(); return; }
  // Load all poll payments
  const paymentData = [];
  for (const poll of allPolls) {
    try {
      const res = await fetch(`/api/payments/${poll.id}`, { credentials: 'include' });
      const payments = await res.json();
      payments.forEach(p => paymentData.push({ ...p, pollSubject: poll.subject }));
    } catch {}
  }
  allPayments = paymentData;
  renderPayments(activeFilter);
}

async function renderMyPaymentsPage() {
  const payments = await fetchMyPayments();
  const container = document.getElementById('paymentsList');
  if (!payments.length) { container.innerHTML = '<div class="card p-8 text-center rounded-2xl"><div class="text-4xl mb-2">💳</div><p class="text-slate-400">No payments yet</p></div>'; return; }
  container.innerHTML = payments.map(p => `
    <div class="card rounded-2xl p-4">
      <div class="flex justify-between items-start mb-2">
        <div>
          <p class="font-semibold">${escHtml(p.pollSubject || 'Print Poll')}</p>
          <p class="text-xs text-slate-400 font-mono">${p.transactionId}</p>
        </div>
        <span class="badge status-${p.status} text-xs">${p.status}</span>
      </div>
      <div class="flex gap-4 text-xs text-slate-400">
        <span>₹${p.amount}</span>
        <span>${p.copies} copies</span>
        <span>${new Date(p.submittedAt).toLocaleDateString()}</span>
      </div>
    </div>`).join('');
}

async function fetchMyPayments() {
  try {
    const res = await fetch('/api/my-payments', { credentials: 'include' });
    return await res.json();
  } catch { return []; }
}

function renderPayments(filter) {
  activeFilter = filter;
  const container = document.getElementById('paymentsList');
  let filtered = filter === 'all' ? allPayments : filter === 'suspicious' ? allPayments.filter(p => ['suspicious','fraud'].includes(p.status)) : allPayments.filter(p => p.status === filter);
  if (!filtered.length) { container.innerHTML = '<div class="card p-8 text-center rounded-2xl"><div class="text-4xl mb-2">💳</div><p class="text-slate-400">No payments in this category</p></div>'; return; }
  container.innerHTML = filtered.map(p => {
    const isSuspect = ['suspicious','fraud'].includes(p.status);
    return `
    <div class="card rounded-2xl p-4 cursor-pointer ${isSuspect ? 'border-orange-500/30' : ''}" onclick="openReviewModal('${p.id}')" style="${isSuspect ? 'border-color:rgba(249,115,22,0.3)' : ''}">
      <div class="flex justify-between items-start mb-2">
        <div>
          <p class="font-semibold text-sm">${escHtml(p.userName || 'Unknown')}</p>
          <p class="text-xs text-slate-400">${escHtml(p.pollSubject || 'Poll')}</p>
        </div>
        <span class="badge status-${p.status} text-xs">${p.status === 'fraud' ? '🚫 Fraud' : p.status === 'suspicious' ? '⚠️ Sus' : p.status}</span>
      </div>
      <div class="flex items-center gap-3 text-xs text-slate-400 mb-2">
        <span class="font-mono">₹${p.amount}</span>
        <span class="font-mono bg-slate-800 px-2 py-0.5 rounded">${escHtml(p.transactionId)}</span>
      </div>
      ${p.fraudFlags?.length ? `<div class="text-xs text-orange-400 mb-2">⚠️ ${p.fraudFlags.join(', ')}</div>` : ''}
      <div class="flex gap-2">
        ${p.status === 'pending' || p.status === 'suspicious' ? `
          <button onclick="event.stopPropagation();reviewPayment('${p.id}','verified')" class="btn-success text-xs px-3 py-1">✅ Approve</button>
          <button onclick="event.stopPropagation();reviewPayment('${p.id}','rejected')" class="btn-danger text-xs px-3 py-1">❌ Reject</button>
          <button onclick="event.stopPropagation();reviewPayment('${p.id}','suspicious')" class="text-xs px-3 py-1 rounded-xl font-semibold" style="background:rgba(249,115,22,0.15);color:#fb923c">⚠️ Flag</button>
        ` : ''}
      </div>
    </div>`;
  }).join('');
}

function filterPayments(filter) {
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.style.background = b.dataset.filter === filter ? 'linear-gradient(135deg,#6366f1,#4f46e5)' : '';
    b.style.color = b.dataset.filter === filter ? 'white' : '';
  });
  renderPayments(filter);
}

async function reviewPayment(paymentId, action) {
  try {
    const res = await fetch(`/api/review-payment/${paymentId}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }), credentials: 'include'
    });
    if (!res.ok) throw new Error('Failed');
    const labels = { verified: '✅ Approved', rejected: '❌ Rejected', suspicious: '⚠️ Flagged' };
    toast(labels[action] || 'Done', action === 'verified' ? 'success' : action === 'rejected' ? 'error' : 'warning');
    await loadPaymentsPage();
  } catch { toast('Action failed', 'error'); }
}

function openReviewModal(paymentId) {
  const p = allPayments.find(pay => pay.id === paymentId);
  if (!p) return;
  document.getElementById('reviewModalContent').innerHTML = `
    <div class="flex items-center gap-2 mb-5">
      <h2 class="font-bold text-lg">Payment Review</h2>
      <span class="badge status-${p.status} ml-2">${p.status}</span>
      <button onclick="closeReviewModal()" class="ml-auto text-slate-400 text-2xl">×</button>
    </div>
    <div class="space-y-3">
      <div class="card p-3 rounded-xl"><p class="text-xs text-slate-400 mb-1">Student</p><p class="font-semibold">${escHtml(p.userName)}</p><p class="text-sm text-slate-400">${escHtml(p.userEmail||'')}</p></div>
      <div class="card p-3 rounded-xl"><p class="text-xs text-slate-400 mb-1">Transaction ID</p><p class="font-mono font-bold">${escHtml(p.transactionId)}</p></div>
      <div class="grid grid-cols-2 gap-3">
        <div class="card p-3 rounded-xl"><p class="text-xs text-slate-400 mb-1">Amount</p><p class="font-bold" style="color:#a5b4fc">₹${p.amount}</p></div>
        <div class="card p-3 rounded-xl"><p class="text-xs text-slate-400 mb-1">Copies</p><p class="font-bold">${p.copies}</p></div>
      </div>
      ${p.screenshot ? `<div><p class="text-xs text-slate-400 mb-2">Screenshot</p><img src="${p.screenshot}" class="w-full rounded-xl max-h-64 object-contain border border-slate-700"/></div>` : ''}
      ${p.fraudFlags?.length ? `<div class="p-3 rounded-xl" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3)"><p class="text-sm font-semibold" style="color:#f87171">⚠️ Fraud Flags</p><p class="text-xs text-slate-400 mt-1">${p.fraudFlags.join(', ')}</p></div>` : ''}
      <p class="text-xs text-slate-500">Submitted: ${new Date(p.submittedAt).toLocaleString()}</p>
      ${p.status !== 'verified' && p.status !== 'rejected' ? `<div class="flex gap-3 mt-2">
        <button onclick="reviewPayment('${p.id}','verified');closeReviewModal()" class="btn-success flex-1">✅ Approve</button>
        <button onclick="reviewPayment('${p.id}','rejected');closeReviewModal()" class="btn-danger flex-1">❌ Reject</button>
      </div>` : ''}
    </div>`;
  document.getElementById('reviewModal').classList.add('open');
}
function closeReviewModal(e) {
  if (e && e.target !== document.getElementById('reviewModal')) return;
  document.getElementById('reviewModal').classList.remove('open');
}

// ============================================================
// REPORT
// ============================================================
async function viewReport(pollId) {
  try {
    const res = await fetch(`/api/report/${pollId}`, { credentials: 'include' });
    const report = await res.json();
    const s = report.summary;
    toast(`Report: ₹${s.totalRevenue} collected, ${s.totalParticipants} students`, 'info');
    const reportWindow = window.open('', '_blank');
    if (reportWindow) {
      reportWindow.document.write(`<html><head><title>Poll Report - ${escHtml(report.poll.subject)}</title><style>body{font-family:sans-serif;padding:24px;max-width:800px;margin:auto}</style></head><body>
      <h1>📊 Poll Report: ${escHtml(report.poll.subject)}</h1>
      <p>Status: ${report.poll.status} | Created: ${new Date(report.poll.createdAt).toLocaleDateString()}</p>
      <h2>Summary</h2>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%">
        <tr><td>Total Participants</td><td>${s.totalParticipants}</td></tr>
        <tr><td>Total Revenue</td><td>₹${s.totalRevenue}</td></tr>
        <tr><td>Verified Payments</td><td>${s.verifiedPayments}</td></tr>
        <tr><td>Pending Payments</td><td>${s.pendingPayments}</td></tr>
        <tr><td>Suspicious</td><td>${s.suspiciousPayments}</td></tr>
        <tr><td>Total Copies</td><td>${s.totalCopies}</td></tr>
      </table></body></html>`);
    }
  } catch { toast('Failed to load report', 'error'); }
}

// ============================================================
// CLOSE POLL
// ============================================================
async function closePoll(pollId) {
  if (!confirm('Close this poll? Students can no longer join.')) return;
  try {
    const res = await fetch(`/api/close-poll/${pollId}`, { method: 'POST', credentials: 'include' });
    if (!res.ok) throw new Error('Failed');
    toast('Poll closed', 'info');
    document.getElementById('pollModal').classList.remove('open');
    await loadPolls();
  } catch { toast('Failed to close poll', 'error'); }
}

async function openPaymentsForPoll(pollId) {
  activeFilter = 'all';
  await loadPaymentsPage();
  showPage('payments');
}

// ============================================================
// PROFILE
// ============================================================
async function loadProfile() {
  if (!currentUser) return;
  const badgeDefs = {
    early_bird: { emoji: '🐦', label: 'Early Bird', desc: 'Joined in first 3' },
    on_time_payer: { emoji: '⚡', label: 'On-Time Payer', desc: 'Paid quickly' },
    verified_payer: { emoji: '✅', label: 'Verified Payer', desc: 'Payment verified' }
  };
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    const user = await res.json();
    const badges = user.badges || [];
    document.getElementById('badgesList').innerHTML = badges.length ? badges.map(b => {
      const def = badgeDefs[b] || { emoji: '🏅', label: b, desc: '' };
      return `<div class="card px-3 py-2 rounded-xl flex items-center gap-2"><span class="text-xl">${def.emoji}</span><div><p class="text-xs font-semibold">${def.label}</p><p class="text-xs text-slate-400">${def.desc}</p></div></div>`;
    }).join('') : '<p class="text-slate-400 text-sm">No badges yet. Be an early joiner!</p>';
  } catch {}

  const payments = await fetchMyPayments();
  const polls = allPolls;
  document.getElementById('myPaymentsList').innerHTML = payments.length ? payments.map(p => {
    const poll = polls.find(pl => pl.id === p.pollId);
    return `<div class="flex items-center justify-between p-2 rounded-xl" style="background:rgba(255,255,255,0.04)">
      <div><p class="text-sm font-medium">${escHtml(poll?.subject || 'Poll')}</p><p class="text-xs text-slate-400 font-mono">${p.transactionId}</p></div>
      <span class="badge status-${p.status} text-xs">${p.status}</span>
    </div>`;
  }).join('') : '<p class="text-slate-400 text-sm">No payments submitted yet</p>';
}

// ============================================================
// NOTIFICATIONS
// ============================================================
function addNotification(notif) {
  allNotifications.unshift({ ...notif, id: Date.now(), read: false });
  document.getElementById('notifBadge').classList.remove('hidden');
}

function checkNotifications() {
  // Check for expiring polls
  const soon = allPolls.filter(p => {
    if (p.status !== 'active') return false;
    const ms = new Date(p.expiryTime) - new Date();
    return ms > 0 && ms < 30 * 60 * 1000;
  });
  soon.forEach(p => addNotification({ title: '⏰ Poll Expiring Soon', message: `"${p.subject}" expires in < 30 minutes`, type: 'warning', time: new Date() }));
}

function renderNotifications() {
  document.getElementById('notifBadge').classList.add('hidden');
  const container = document.getElementById('notificationsList');
  if (!allNotifications.length) {
    container.innerHTML = '<div class="card p-8 text-center rounded-2xl"><div class="text-4xl mb-2">🔔</div><p class="text-slate-400">No notifications</p></div>';
    return;
  }
  container.innerHTML = allNotifications.map(n => {
    const icons = { success: '✅', warning: '⚠️', error: '❌', info: 'ℹ️' };
    return `<div class="card rounded-2xl p-4 flex gap-3">
      <span class="text-xl">${icons[n.type] || 'ℹ️'}</span>
      <div><p class="font-semibold text-sm">${escHtml(n.title)}</p><p class="text-xs text-slate-400">${escHtml(n.message)}</p><p class="text-xs text-slate-500 mt-1">${n.time ? new Date(n.time).toLocaleTimeString() : ''}</p></div>
    </div>`;
  }).join('');
}

// ============================================================
// COUNTDOWNS
// ============================================================
function startCountdowns(polls) {
  clearCountdowns();
  polls.forEach(poll => {
    const el = document.getElementById(`countdown-${poll.id}`);
    if (el) startSingleCountdown(poll.id, poll.expiryTime, el);
  });
}
function startSingleCountdown(pollId, expiryTime, el) {
  const update = () => {
    const ms = new Date(expiryTime) - new Date();
    if (ms <= 0) { if (el) el.textContent = 'Expired'; return; }
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    if (el) el.textContent = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    if (ms < 30 * 60 * 1000 && el) el.style.color = '#f87171';
  };
  update();
  countdownTimers[pollId] = setInterval(update, 1000);
}
function clearCountdowns() {
  Object.values(countdownTimers).forEach(t => clearInterval(t));
  countdownTimers = {};
}

// ============================================================
// UTILS
// ============================================================
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#x27;');
}

// ============================================================
// INIT
// ============================================================
async function init() {
  initDarkMode();
  try {
    const res = await fetch('/api/me', { credentials: 'include' });
    if (res.ok) {
      currentUser = await res.json();
      onLogin();
    }
  } catch {}
}

init();

// ============================================================
// SMART QUEUE
// ============================================================
function renderQueueCard(poll) {
  const participant = poll.participants?.find(p => p.userId === currentUser?.id);
  if (!participant) return '';
  const totalInQueue = poll.participants.length;
  const myPos = participant.queuePosition || 1;
  const estimatedWait = (myPos - 1) * 2;
  const progressPct = Math.max(0, 100 - ((myPos / totalInQueue) * 100));

  return `
  <div class="card rounded-2xl p-4 mb-3" style="border:1px solid rgba(99,102,241,0.3)">
    <div class="flex items-center gap-2 mb-3">
      <span class="text-lg">🔢</span>
      <h3 class="font-bold text-sm">Your Queue Position</h3>
      <span class="ml-auto font-mono font-bold text-lg grad">#${myPos}</span>
    </div>
    <div class="progress-bar mb-2"><div class="progress-fill" style="width:${progressPct}%"></div></div>
    <div class="flex justify-between text-xs text-slate-400">
      <span>~${estimatedWait}m wait</span>
      <span>${totalInQueue} total in queue</span>
    </div>
  </div>`;
}

// ============================================================
// BADGE DEFINITIONS (extended)
// ============================================================
const BADGE_DEFS = {
  early_bird:      { emoji: '🐦', label: 'Early Bird',      desc: 'One of first 3 joiners',     color: '#f59e0b' },
  on_time_payer:   { emoji: '⚡', label: 'Quick Payer',     desc: 'Paid within minutes',         color: '#6366f1' },
  verified_payer:  { emoji: '✅', label: 'Verified Payer',  desc: 'Payment approved by CR',      color: '#22c55e' },
  loyal_member:    { emoji: '💎', label: 'Loyal Member',    desc: 'Joined 5+ polls',             color: '#06b6d4' },
  first_poll:      { emoji: '🚀', label: 'First Poll',      desc: 'Joined your first poll',      color: '#a78bfa' }
};

function getBadgeHTML(badgeKey) {
  const b = BADGE_DEFS[badgeKey] || { emoji: '🏅', label: badgeKey, desc: '', color: '#94a3b8' };
  return `
  <div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08)">
    <span class="text-2xl">${b.emoji}</span>
    <div>
      <p class="text-xs font-bold" style="color:${b.color}">${b.label}</p>
      <p class="text-xs text-slate-400">${b.desc}</p>
    </div>
  </div>`;
}

// ============================================================
// POLL EXPIRY ALERTS (runs every minute)
// ============================================================
setInterval(() => {
  if (!currentUser || !allPolls.length) return;
  allPolls.forEach(poll => {
    if (poll.status !== 'active') return;
    const ms = new Date(poll.expiryTime) - new Date();
    // Alert at 10 minute mark
    if (ms > 0 && ms < 10 * 60 * 1000 && ms > 9 * 60 * 1000) {
      const joined = poll.participants?.find(p => p.userId === currentUser?.id);
      if (joined && joined.paymentStatus === 'pending') {
        toast(`⏰ "${poll.subject}" expires in 10 min! Submit payment now!`, 'warning');
        addNotification({
          title: '⏰ Urgent: Poll Expiring',
          message: `"${poll.subject}" closes in ~10 minutes. Submit payment!`,
          type: 'warning',
          time: new Date()
        });
      }
    }
  });
}, 60 * 1000);
