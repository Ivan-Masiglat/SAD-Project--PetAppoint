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

let bookingCalendarState = null;

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

function openBookingPreview() {
  const modal = document.getElementById('booking-preview-modal');
  if (!modal) return;
  modal.classList.add('show');
  bookingCalendarState = null;
  document.getElementById('booking-calendar-grid').innerHTML =
    '<p class="booking-preview-loading">Checking the calendar…</p>';
  document.getElementById('booking-preview-times').innerHTML =
    '<p class="booking-preview-loading">Select a day to see times.</p>';
  document.getElementById('booking-preview-error').hidden = true;
  loadBookingPreview();
}

function closeBookingPreview() {
  document.getElementById('booking-preview-modal')?.classList.remove('show');
}

function handleBookingPreviewBackdrop(event) {
  if (event.target.id === 'booking-preview-modal') closeBookingPreview();
}

function continueToBooking() {
  const session = typeof PA !== 'undefined' ? PA.getSession() : null;
  closeBookingPreview();
  if (session?.role === 'admin') {
    window.location.href = '../admin/dashboard.html';
    return;
  }
  if (session?.role === 'client') {
    window.location.href = '../booking/booking.html';
    return;
  }
  const url = new URL(window.location.href);
  url.searchParams.set('next', 'booking');
  window.history.replaceState({}, '', url);
  openModal('signup');
}

function formatBookingDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric'
  });
}

function bookingDateKey(date) {
  return date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' +
    String(date.getDate()).padStart(2, '0');
}

function bookingTimeSlots(date) {
  const closingHour = date.getDay() === 0 ? 17 : 20;
  const hours = [9, 10, 11];
  for (let hour = 13; hour <= closingHour; hour++) hours.push(hour);
  return hours.map(hour => ({
    hour,
    label: (hour % 12 || 12) + ':00 ' + (hour < 12 ? 'AM' : 'PM')
  }));
}

function isBookingTimeAvailable(date, time, reserved) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hour);
  return start > new Date() && !reserved.has(bookingDateKey(date) + '|' + time.label.toUpperCase());
}

function renderBookingCalendar() {
  const state = bookingCalendarState;
  if (!state) return;
  const grid = document.getElementById('booking-calendar-grid');
  const monthLabel = document.getElementById('booking-calendar-month');
  const prevButton = document.getElementById('booking-month-prev');
  const nextButton = document.getElementById('booking-month-next');
  const monthStart = new Date(state.month.getFullYear(), state.month.getMonth(), 1);
  const lastDay = new Date(state.month.getFullYear(), state.month.getMonth() + 1, 0).getDate();
  const firstAllowedMonth = new Date(state.fromDate.getFullYear(), state.fromDate.getMonth(), 1);
  const lastAllowedMonth = new Date(state.untilDate.getFullYear(), state.untilDate.getMonth(), 1);
  monthLabel.textContent = state.month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  prevButton.disabled = monthStart <= firstAllowedMonth;
  nextButton.disabled = monthStart >= lastAllowedMonth;
  grid.replaceChildren();

  ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => {
    const weekday = document.createElement('span');
    weekday.className = 'booking-calendar-weekday';
    weekday.textContent = day;
    grid.appendChild(weekday);
  });
  for (let blank = 0; blank < monthStart.getDay(); blank++) {
    const empty = document.createElement('span');
    empty.setAttribute('aria-hidden', 'true');
    grid.appendChild(empty);
  }
  for (let day = 1; day <= lastDay; day++) {
    const date = new Date(state.month.getFullYear(), state.month.getMonth(), day);
    const key = bookingDateKey(date);
    const inRange = date >= state.fromDate && date <= state.untilDate;
    const slots = bookingTimeSlots(date);
    const openCount = inRange
      ? slots.filter(time => isBookingTimeAvailable(date, time, state.reserved)).length
      : 0;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'booking-calendar-day';
    button.textContent = String(day);
    button.classList.add(openCount > 0 ? 'has-open-times' : 'has-no-open-times');
    if (key === state.selectedDateKey) button.classList.add('is-selected');
    if (key === bookingDateKey(new Date())) button.classList.add('is-today');
    button.setAttribute('aria-label', formatBookingDate(date) + (inRange
      ? ', ' + openCount + ' available times'
      : ', unavailable'));
    button.disabled = !inRange;
    if (inRange) {
      button.addEventListener('click', () => {
        state.selectedDateKey = key;
        state.selectedTime = '';
        renderBookingCalendar();
        renderBookingTimes();
      });
    }
    grid.appendChild(button);
  }
}

function renderBookingTimes() {
  const state = bookingCalendarState;
  if (!state) return;
  const container = document.getElementById('booking-preview-times');
  const selectedDateLabel = document.getElementById('booking-selected-date');
  const date = new Date(state.selectedDateKey + 'T00:00:00');
  selectedDateLabel.textContent = formatBookingDate(date);
  container.replaceChildren();
  const times = bookingTimeSlots(date);
  if (!times.length) {
    container.innerHTML = '<p class="booking-preview-empty">No appointment times are scheduled on this day.</p>';
    return;
  }
  times.forEach(time => {
    const available = isBookingTimeAvailable(date, time, state.reserved);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'booking-time-slot';
    button.textContent = time.label;
    button.disabled = !available;
    if (state.selectedTime === time.label) button.classList.add('is-selected');
    button.setAttribute('aria-label', time.label + (available ? ', available' : ', unavailable'));
    if (available) {
      button.addEventListener('click', () => {
        state.selectedTime = time.label;
        renderBookingTimes();
      });
    }
    container.appendChild(button);
  });
}

async function loadBookingPreview() {
  const errorMessage = document.getElementById('booking-preview-error');
  const fromDate = new Date();
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const until = new Date(from);
  until.setDate(until.getDate() + 60);
  const toDate = until.getFullYear() + '-' +
    String(until.getMonth() + 1).padStart(2, '0') + '-' +
    String(until.getDate()).padStart(2, '0');
  const fromKey = from.getFullYear() + '-' +
    String(from.getMonth() + 1).padStart(2, '0') + '-' +
    String(from.getDate()).padStart(2, '0');

  try {
    const firebase = await import('../shared/firebase.js');
    const availability = await firebase.getBookedAppointmentSlots(fromKey, toDate);
    const reserved = new Set(availability.map(slot =>
      slot.date + '|' + String(slot.time || '').toUpperCase()
    ));
    bookingCalendarState = {
      fromDate: from,
      untilDate: until,
      month: new Date(from.getFullYear(), from.getMonth(), 1),
      selectedDateKey: fromKey,
      selectedTime: '',
      reserved
    };
    for (let offset = 0; offset <= 60; offset++) {
      const date = new Date(from.getFullYear(), from.getMonth(), from.getDate() + offset);
      if (bookingTimeSlots(date).some(time => isBookingTimeAvailable(date, time, reserved))) {
        bookingCalendarState.selectedDateKey = bookingDateKey(date);
        bookingCalendarState.month = new Date(date.getFullYear(), date.getMonth(), 1);
        break;
      }
    }
    renderBookingCalendar();
    renderBookingTimes();
  } catch (error) {
    console.error('Could not connect to Firebase for the booking preview.', error);
    document.getElementById('booking-calendar-grid').innerHTML =
      '<p class="booking-preview-empty">Calendar availability could not be loaded. Please try again later.</p>';
    document.getElementById('booking-preview-times').innerHTML =
      '<p class="booking-preview-empty">Appointment times are unavailable until the calendar loads.</p>';
    errorMessage.textContent = error.message || 'Check your connection and try again.';
    errorMessage.hidden = false;
  }
}

function closeModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) {
    modal.classList.remove('show');
  }
}

document.getElementById('booking-month-prev')?.addEventListener('click', () => {
  if (!bookingCalendarState) return;
  bookingCalendarState.month = new Date(
    bookingCalendarState.month.getFullYear(),
    bookingCalendarState.month.getMonth() - 1,
    1
  );
  renderBookingCalendar();
});

document.getElementById('booking-month-next')?.addEventListener('click', () => {
  if (!bookingCalendarState) return;
  bookingCalendarState.month = new Date(
    bookingCalendarState.month.getFullYear(),
    bookingCalendarState.month.getMonth() + 1,
    1
  );
  renderBookingCalendar();
});

window.addEventListener('keydown', event => {
  if (event.key === 'Escape') closeBookingPreview();
});

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

async function handleAuth(event, type) {
  event.preventDefault();
  const form = event.target;

  if (type === 'login') {
    const email = form.querySelector('input[type="email"]').value;
    const password = form.querySelector('input[type="password"]').value;
    if (email.trim().toLowerCase() === 'admin@gmail.com') {
      try {
        await PA.loginAdmin(email, password);
        window.location.href = '../admin/dashboard.html';
      } catch (error) {
        console.error('Firebase admin sign-in failed.', error);
        showToast('Admin sign-in failed. Check the email and password, then try again.');
      }
      return;
    }
    try {
      await PA.loginClient(email, password);
    } catch (error) {
      console.error('Firebase client sign-in failed.', error);
      showToast(error.code === 'auth/invalid-credential'
        ? 'Email or password is incorrect.'
        : 'Could not sign in. Check your email and password, then try again.');
      return;
    }
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next === 'booking'
      ? '../booking/booking.html'
      : '../homepage/Homepage.html';
    return;
  }

  // SIGN UP
  const text = form.querySelectorAll('input[type="text"]');
  const email = form.querySelector('input[type="email"]').value;
  if (email.trim().toLowerCase() === 'admin@gmail.com') {
    showToast('This email is reserved for the clinic administrator.');
    return;
  }
  const pw = form.querySelectorAll('input[type="password"]');
  if (pw[0].value !== pw[1].value) {
    showToast('Passwords do not match.');
    return;
  }
  const submit = form.querySelector('[type="submit"]');
  submit.disabled = true;
  try {
    await PA.registerClient({
      firstName: text[0].value,
      lastName: text[1].value,
      email,
      phone: form.querySelector('input[type="tel"]').value
    }, pw[0].value);
    const next = new URLSearchParams(window.location.search).get('next');
    window.location.href = next === 'booking'
      ? '../booking/booking.html'
      : '../homepage/Homepage.html';
  } catch (error) {
    console.error('Firebase client registration failed.', error);
    const messages = {
      'auth/email-already-in-use': 'An account already exists for that email. Please log in.',
      'auth/weak-password': 'Choose a password with at least 6 characters.',
      'auth/invalid-email': 'Enter a valid email address.',
      'permission-denied': 'Firebase blocked profile creation. Check the published Firestore rules.'
    };
    showToast(messages[error.code] || error.message ||
      'Could not create the account. Check your connection and try again.');
  } finally {
    submit.disabled = false;
  }
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