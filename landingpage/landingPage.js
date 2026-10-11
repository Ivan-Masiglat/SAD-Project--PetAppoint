// ============================================================
// CONFIGURATION - EASILY CHANGE LOCATION / CONTACT DETAILS HERE
// ============================================================
const CLINIC_CONFIG = {
  // Coordinates: Antipolo, Rizal
  latitude: 14.575087,
  longitude: 121.184143,
  zoom: 16,
  addressText: "Lincoln St, Antipolo, Rizal",
  phoneNumber: "(02) 0000-0000",
  emailAddress: "PetAppoint@vet.ph"
};

// ============================================================
// INITIALIZATION
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  // Update Google Map Embed
  const mapFrame = document.getElementById('map-frame');
  if (mapFrame) {
    mapFrame.src = `https://maps.google.com/maps?q=${CLINIC_CONFIG.latitude},${CLINIC_CONFIG.longitude}&z=${CLINIC_CONFIG.zoom}&output=embed`;
  }

  // Update Footer Information
  const addressEl = document.getElementById('footer-address');
  const phoneEl = document.getElementById('footer-phone');
  const emailEl = document.getElementById('footer-email');

  if (addressEl) addressEl.textContent = CLINIC_CONFIG.addressText;
  if (phoneEl) phoneEl.textContent = CLINIC_CONFIG.phoneNumber;
  if (emailEl) {
    emailEl.textContent = CLINIC_CONFIG.emailAddress;
    emailEl.href = `mailto:${CLINIC_CONFIG.emailAddress}`;
  }
});

// ============================================================
// VIEW NAVIGATION (Home, About, Inquire)
// ============================================================
function showView(viewId, linkEl) {
  // Hide all views
  const views = document.querySelectorAll('.view');
  views.forEach(view => view.classList.remove('active'));

  // Show target view
  const targetView = document.getElementById(`view-${viewId}`);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Update active nav link
  const navLinks = document.querySelectorAll('#nav-list a');
  navLinks.forEach(link => link.classList.remove('active'));
  if (linkEl) {
    linkEl.classList.add('active');
  }

  // Close mobile nav menu if open
  const navList = document.getElementById('nav-list');
  if (navList) navList.classList.remove('open');

  window.scrollTo(0, 0);
}

function toggleMenu() {
  const navList = document.getElementById('nav-list');
  if (navList) {
    navList.classList.toggle('open');
  }
}

// ============================================================
// AUTH MODAL & TABS
// ============================================================
function openModal(defaultTab = 'login') {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.add('show');
    switchTab(defaultTab);
  }
}

function closeModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

function switchTab(tab) {
  const loginForm = document.getElementById('form-login');
  const signupForm = document.getElementById('form-signup');
  const loginBtn = document.getElementById('tab-login-btn');
  const signupBtn = document.getElementById('tab-signup-btn');

  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    signupForm.classList.add('hidden');
    loginBtn.classList.add('on');
    signupBtn.classList.remove('on');
  } else {
    loginForm.classList.add('hidden');
    signupForm.classList.remove('hidden');
    signupBtn.classList.add('on');
    loginBtn.classList.remove('on');
  }
}

function handleAuth(event, type) {
  event.preventDefault();

  if (type === 'login') {
    window.location.href = '../homepage/Homepage.html';
    return;
  }

  closeModal();
  showToast('Account created successfully!');
}

// ============================================================
// TOAST NOTIFICATIONS
// ============================================================
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}