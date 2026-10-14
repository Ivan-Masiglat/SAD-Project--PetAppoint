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

  const navBtn = document.getElementById('nav-auth-btn');
  if (navBtn && PA.getSession()) {
    navBtn.textContent = 'My Account';
    navBtn.onclick = () => { window.location.href = '../homepage/Homepage.html'; };
  }

  const hash = window.location.hash.replace('#', '');
  if (hash === 'about' || hash === 'inquire') {
    showView(hash, document.querySelector(`#nav-list a[href="#${hash}"]`));
  }

  if (new URLSearchParams(window.location.search).get('login') === '1') {
    openModal('login');
    showToast('Please log in first to book an appointment.');
  }
});

// ============================================================
// BOOKING NEEDS A LOGIN
// ============================================================
function startBooking() {
  if (PA.getSession()) {
    window.location.href = '../booking/booking.html';
    return;
  }
  openModal('login');
  showToast('Please log in or sign up first to book an appointment.');
}

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
  const form = event.target;

  if (type === 'login') {
    // Front-end prototype
    PA.login(form.querySelector('input[type="email"]').value);

    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next === 'booking'
      ? '../booking/booking.html'
      : '../homepage/Homepage.html';
    return;
  }

  // SIGN UP
  const text = form.querySelectorAll('input[type="text"]');
  const email = form.querySelector('input[type="email"]').value;
  const pw = form.querySelectorAll('input[type="password"]');
  if (pw[0].value !== pw[1].value) {
    showToast('Passwords do not match.');
    return;
  }
  PA.saveAccount({
    firstName: text[0].value.trim(),
    lastName: text[1].value.trim(),
    email: email,
    phone: form.querySelector('input[type="tel"]').value
  });
  form.reset();
  switchTab('login');
  showToast('Account created! Please log in to continue.');
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