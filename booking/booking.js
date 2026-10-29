const CLINIC = {
  name: 'PetAppoint Veterinary Clinic',
  address: 'Lincoln St, Antipolo, Rizal'
};

// Treatments shown in step 2 (same list as the landing page "Our Services")
const SERVICES = [
  { id: 'wellness',    title: 'Wellness Check-up',    minutes: 30, desc: 'Full physical exam with advice on diet, weight and routine care.',
    icon: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>' },
  { id: 'vaccination', title: 'Vaccinations',         minutes: 20, desc: "Core and optional vaccines for your pet's age, species and lifestyle.",
    icon: '<path d="m18 2 4 4"/><path d="m17 7 3-3"/><path d="M19 9 8.7 19.3a1 1 0 0 1-1.4 0L4.7 16.7a1 1 0 0 1 0-1.4L15 5"/><path d="m9 11 4 4"/><path d="m5 19-3 3"/><path d="m14 4 6 6"/>' },
  { id: 'dental',      title: 'Dental Care',          minutes: 45, desc: 'Teeth cleaning and oral checks to prevent gum disease.',
    icon: '<path d="M12 5.5C10 3 6 3 5 6c-.8 2.5.8 5 1.5 8 .5 2.5 1 6 2.5 6 1.2 0 1.2-3 3-3s1.8 3 3 3c1.5 0 2-3.5 2.5-6 .7-3 2.3-5.5 1.5-8-1-3-5-3-7-.5Z"/>' },
  { id: 'grooming',    title: 'Grooming & Hygiene',   minutes: 60, desc: 'Bath, trim, nail clipping and ear cleaning by gentle, trained staff.',
    icon: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88"/><path d="M14.47 14.48 20 20"/><path d="M8.12 8.12 12 12"/>' },
  { id: 'procedures',  title: 'Minor Procedures',     minutes: 60, desc: 'Spay/neuter consultations and minor procedures. Pre-op screening required.',
    icon: '<path d="M4 4v5a5 5 0 0 0 10 0V4"/><path d="M9 14v2a5 5 0 0 0 10 0v-2"/><circle cx="19" cy="12" r="2"/>' },
  { id: 'senior',      title: 'Senior & Special Care', minutes: 40, desc: 'Gentle, accessible care plans for older pets and pets with special needs.',
    icon: '<path d="M20.8 5.7a5.5 5.5 0 0 0-7.8 0L12 6.8l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 22l8.8-8.5a5.5 5.5 0 0 0 0-7.8Z"/>' }
];

// Regular appointments pause for lunch; emergency appointments use all 24 hours.
const MORNING_TIME_SLOTS = ['9:00 AM', '10:00 AM', '11:00 AM'];
const afternoonTimeSlots = closingHour => Array.from(
  { length: closingHour - 12 },
  (_, index) => (index + 1) + ':00 PM'
);

const OTHER_SERVICE_MINUTES = 30;

// ============================================================
// LOGIN GUARD - booking is only for logged-in users
// ============================================================
const session = PA.getSession();
if (!session) {
  location.replace('../landingpage/landingPage.html?login=1&next=booking');
} else if (session.role === 'admin') {
  location.replace('../admin/dashboard.html');
} else {
  document.body.classList.remove('auth-pending');
  init();
}

// ============================================================
function init() {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DOW = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const DOW_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const DOW_LONG = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const WINDOW_DAYS = 6;
  const bookedSlotKeys = new Set();
  const loadedAvailabilityDates = new Set();
  let availabilityLoading = false;

  const $ = id => document.getElementById(id);
  const svg = inner => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  const CHECK = svg('<path d="m5 12 4 4L19 6"/>');

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ----- state -----
  let step = 1;
  let petId = null;
  let serviceIds = [];
  const customServices = [];
  let slot = null;                    // { dateKey, time }
  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();
  let windowStart = new Date(today);  // first of the 6 days shown
  let lastBooked = null;

  // ----- helpers -----
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
  const sameDay = (a, b) => key(a) === key(b);
  const longDate = d => DOW_LONG[d.getDay()] + ', ' + MONTHS_LONG[d.getMonth()] + ' ' + d.getDate() + ', ' + d.getFullYear();
  const shortDate = d => DOW_SHORT[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function to24(time) {
    const [hm, ap] = time.split(' ');
    let [h, m] = hm.split(':').map(Number);
    if (ap === 'PM' && h !== 12) h += 12;
    if (ap === 'AM' && h === 12) h = 0;
    return { h, m };
  }

  function petAge(birth) {
    if (!birth) return '';
    const b = new Date(birth + 'T00:00:00');
    let months = (today.getFullYear() - b.getFullYear()) * 12 + (today.getMonth() - b.getMonth());
    if (today.getDate() < b.getDate()) months--;
    if (months < 0) return '';
    if (months < 12) return months + (months === 1 ? ' month' : ' months');
    const y = Math.floor(months / 12);
    return y + (y === 1 ? ' yr' : ' yrs');
  }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3200);
  }

  const getPet = () => PA.getPets().find(p => p.id === petId);
  const allServices = () => SERVICES.concat(customServices);
  const getSelectedServices = () => serviceIds.map(id => allServices().find(service => service.id === id));
  const getServiceNames = () => serviceIds.map(id => id === 'other'
    ? 'Other: ' + $('other-treatment').value.trim()
    : allServices().find(service => service.id === id)?.title || '');
  const getTotalMinutes = () => getSelectedServices().reduce((total, service) =>
    total + (service ? service.minutes : OTHER_SERVICE_MINUTES), 0);
  const hasValidTreatments = () => serviceIds.length > 0 &&
    (!serviceIds.includes('other') || Boolean($('other-treatment').value.trim()));

  // ----- header -----
  $('user-avatar').textContent = PA.initials(session);
  $('user-name').textContent = session.fullName || session.firstName;
  $('logout-btn').addEventListener('click', async () => {
    try {
      await PA.logout();
      location.href = '../landingpage/landingPage.html';
    } catch (error) {
      console.error('Could not sign out.', error);
      window.alert('Could not sign out. Please check your connection and try again.');
    }
  });
  $('news-form').addEventListener('submit', e => { e.preventDefault(); e.target.reset(); toast('Subscribed to newsletter!'); });

  // ============================================================
  // STEPPER + STEP SWITCHING
  // ============================================================
  const STEP_INFO = {
    1: { title: 'Who are we caring for?', sub: "Select the pet you'd like to bring in." },
    2: { title: 'What treatment do you need?', sub: "Choose the service that best fits your pet's needs." },
    3: { title: 'Select Date and Time', sub: 'Pick an available slot that works for you.' }
  };

  function renderStepper() {
    const labels = ['Pet', 'Treatment', 'Date & time'];
    $('stepper').innerHTML = labels.map((label, i) => {
      const n = i + 1;
      const cls = step === n ? 'active' : step > n ? 'done' : '';
      return '<li class="' + cls + '"><span class="dot">' + (step > n ? CHECK : n) + '</span><b>' + label + '</b>' +
             (i < 2 ? '<span class="bar"></span>' : '') + '</li>';
    }).join('');
  }

  function goStep(n) {
    step = n;
    $('step-pet').hidden = n !== 1;
    $('step-service').hidden = n !== 2;
    $('step-time').hidden = n !== 3;
    $('step-title').textContent = STEP_INFO[n].title;
    $('step-sub').textContent = STEP_INFO[n].sub;
    $('step-sub').hidden = n === 3;
    renderStepper();
    renderSummary();
    if (n === 3) {
      renderCalendar();
      renderWeek();
      loadAvailabilityForWindow();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSummary() {
    const pet = getPet();
    const services = getServiceNames().filter(Boolean).join(', ');
    let text = 'Choose a pet to begin';
    if (pet) {
      if (step === 1) text = pet.name;
      else if (step === 2) text = pet.name + ' · ' + (services || 'choose a treatment');
      else text = pet.name + ' · ' + services + ' · ' +
                  (slot ? shortDate(fromKey(slot.dateKey)) + ', ' + slot.time : 'choose a date and time');
    }
    $('summary-text').textContent = text;

    const next = $('next-btn');
    if (step === 1) { next.innerHTML = 'Continue &rarr;'; next.disabled = !pet; }
    if (step === 2) { next.innerHTML = 'Continue &rarr;'; next.disabled = !hasValidTreatments(); }
    if (step === 3) { next.innerHTML = 'Confirm appointment &rarr;'; next.disabled = !slot; }
    $('back-btn').innerHTML = step === 1 ? '&larr; Back to home' : '&larr; Back';
  }

  $('back-btn').addEventListener('click', () => {
    if (step === 1) location.href = '../homepage/Homepage.html';
    else goStep(step - 1);
  });
  $('next-btn').addEventListener('click', async () => {
    if (step === 1 && petId) goStep(2);
    else if (step === 2 && hasValidTreatments()) goStep(3);
    else if (step === 3 && slot) {
      const next = $('next-btn');
      next.disabled = true;
      try {
        await confirmBooking();
      } catch (error) {
        console.error('Could not save appointment to Firestore.', error);
        toast(error.message && error.message.includes('just taken')
          ? 'That time was just booked. Please choose another open time.'
          : 'Your appointment could not be submitted. Please check your connection and try again.');
        slot = null;
        if (step === 3) loadAvailabilityForWindow(true);
        renderSummary();
      }
    }
  });

  // ============================================================
  // STEP 1: PET
  // ============================================================
  function renderPets() {
    const pets = PA.getPets();
    const cards = pets.map((p, i) => {
      const detail = [p.breed || p.species, p.sex, petAge(p.birth)].filter(Boolean).join(' · ');
      return '<button type="button" class="choice' + (p.id === petId ? ' selected' : '') + '" data-pet="' + esc(p.id) + '">' +
        '<span class="avatar' + (i % 2 ? ' alt' : '') + '">' + esc(p.name[0].toUpperCase()) + '</span>' +
        '<span class="txt"><b>' + esc(p.name) + '</b><small>' + esc(detail) + '</small></span>' +
        '<span class="tick">' + CHECK + '</span></button>';
    });
    cards.push('<button type="button" class="choice add" id="add-pet-card"><span class="plus">+</span>' +
      '<span class="txt"><b>Add a new pet</b><small>Create a profile first</small></span></button>');
    let html = cards.join('');
    if (!pets.length) html += '<p class="empty-note">You have no pets yet. Add your first pet to continue.</p>';
    $('pet-list').innerHTML = html;
  }

  $('pet-list').addEventListener('click', e => {
    const add = e.target.closest('#add-pet-card');
    if (add) return openPetDialog();
    const card = e.target.closest('[data-pet]');
    if (!card) return;
    petId = card.dataset.pet;
    renderPets();
    renderSummary();
  });

  // ----- add pet dialog -----
  const dlg = $('pet-dialog');
  function openPetDialog() {
    $('pet-form').reset();
    $('pet-birth').max = key(today);
    $('pet-birth').min = (today.getFullYear() - 100) + '-01-01';
    updateOtherSpeciesField();
    dlg.hidden = false;
    $('pet-form').elements.name.focus();
  }
  function updateOtherSpeciesField() {
    const isOther = $('pet-species').value === 'Other';
    $('pet-other-species-field').hidden = !isOther;
    $('pet-form').elements.otherSpecies.required = isOther;
    if (!isOther) $('pet-form').elements.otherSpecies.value = '';
  }
  $('pet-species').addEventListener('change', updateOtherSpeciesField);
  function closePetDialog() { dlg.hidden = true; }
  $('pet-close').addEventListener('click', closePetDialog);
  $('pet-cancel').addEventListener('click', closePetDialog);
  dlg.addEventListener('mousedown', e => { if (e.target === dlg) closePetDialog(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !dlg.hidden) closePetDialog(); });
  $('pet-form').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.elements;
    const name = f.name.value.trim();
    if (!name) return;
    const birth = f.birth.value;
    const minBirth = (today.getFullYear() - 100) + '-01-01';
    if (birth && (birth < minBirth || birth > $('pet-birth').max)) {
      $('pet-birth').setCustomValidity('Enter a date within the last 100 years.');
      $('pet-birth').reportValidity();
      $('pet-birth').setCustomValidity('');
      return;
    }
    const species = f.species.value === 'Other' ? f.otherSpecies.value.trim() : f.species.value;
    const saved = PA.addPet({
      name, species, sex: f.sex.value,
      breed: f.breed.value.trim(), birth
    });
    if (!saved) {
      toast('Could not save the pet. Please try again.');
      return;
    }
    petId = saved ? saved.id : null;
    closePetDialog();
    renderPets();
    renderSummary();
    toast(name + ' was added to your pets.');
  });

  // ============================================================
  // STEP 2: TREATMENT
  // ============================================================
  function renderServices() {
    const services = allServices().concat([{
      id: 'other',
      title: 'Other treatment',
      minutes: OTHER_SERVICE_MINUTES,
      desc: 'Specify another treatment not listed here.',
      icon: '<path d="M12 5v14M5 12h14"/>'
    }]);
    $('service-list').innerHTML = services.map(service => {
      const selected = serviceIds.includes(service.id);
      return '<button type="button" class="choice' + (selected ? ' selected' : '') +
        '" data-service="' + service.id + '" aria-pressed="' + selected + '">' +
        '<span class="ico">' + svg(service.icon) + '</span>' +
        '<span class="txt"><b>' + esc(service.title) + '</b><small>' + esc(service.desc) +
        '</small><span class="mins">About ' + service.minutes + ' min</span></span>' +
        '<span class="tick">' + CHECK + '</span></button>';
    }).join('');
    const otherSelected = serviceIds.includes('other');
    $('other-treatment-field').hidden = !otherSelected;
    $('other-treatment').required = otherSelected;
  }

  async function loadCustomServices() {
    const message = $('service-load-error');
    try {
      const { getServices } = await import('../shared/firebase.js');
      const services = await getServices();
      customServices.splice(0, customServices.length, ...services.map(service => ({
        id: 'custom-' + service.id,
        title: service.name,
        minutes: service.minutes,
        desc: service.description,
        icon: '<path d="M12 5v14M5 12h14"/>'
      })));
      renderServices();
    } catch (error) {
      console.error('Could not load custom services for booking.', error);
      if (message) {
        message.hidden = false;
        message.textContent = 'Additional services are temporarily unavailable. Please try again later.';
      }
    }
  }
  $('service-list').addEventListener('click', e => {
    const card = e.target.closest('[data-service]');
    if (!card) return;
    const id = card.dataset.service;
    serviceIds = serviceIds.includes(id)
      ? serviceIds.filter(serviceId => serviceId !== id)
      : serviceIds.concat(id);
    slot = null;
    renderServices();
    renderSummary();
  });
  $('other-treatment').addEventListener('input', renderSummary);

  // ============================================================
  // STEP 3: DATE & TIME (mini calendar + 6-day grid)
  // ============================================================
  const monthSel = $('month-select');
  const yearSel = $('year-select');
  MONTHS.forEach((m, i) => monthSel.add(new Option(m, i)));
  for (let y = today.getFullYear(); y <= today.getFullYear() + 1; y++) yearSel.add(new Option(y, y));

  const ym = (y, m) => y * 12 + m;
  const minYM = ym(today.getFullYear(), today.getMonth());
  const maxYM = ym(today.getFullYear() + 1, 11);

  function setMonth(y, m) {
    const v = Math.min(Math.max(ym(y, m), minYM), maxYM);   // stay inside the bookable range
    viewYear = Math.floor(v / 12);
    viewMonth = v % 12;
    const lastDay = new Date(viewYear, viewMonth + 1, 0).getDate();
    windowStart = new Date(viewYear, viewMonth, Math.min(windowStart.getDate(), lastDay));
    renderCalendar();
    renderWeek();
    loadAvailabilityForWindow();
  }

  function renderWeek() {
    const week = $('week');
    week.innerHTML = '';
    const days = [];
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = addDays(windowStart, i);
      days.push(d);
      const head = document.createElement('div');
      head.className = 'day-head';
      head.innerHTML = '<div class="name">' + DOW_SHORT[d.getDay()] + '</div>' +
        '<div class="num">' + String(d.getDate()).padStart(2, '0') + '</div>';
      week.appendChild(head);
    }

    function appendTimeGroup(date, times) {
      const group = document.createElement('div');
      group.className = 'day-slots';
      group.setAttribute('aria-label', longDate(date));
      times.forEach(time => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'slot';
        button.textContent = time;
        button.setAttribute('aria-label', longDate(date) + ' at ' + time);
        const dateKey = key(date);
        const slotKey = dateKey + '|' + time.toUpperCase();
        const availabilityReady = loadedAvailabilityDates.has(dateKey);
        const isPast = new Date(date.getFullYear(), date.getMonth(), date.getDate(), to24(time).h, to24(time).m) <= new Date();
        const isBooked = bookedSlotKeys.has(slotKey);
        button.disabled = !availabilityReady || availabilityLoading || isPast || isBooked;
        if (isBooked) {
          button.classList.add('booked');
          button.setAttribute('aria-label', longDate(date) + ' at ' + time + ', unavailable');
        } else if (!availabilityReady || availabilityLoading) {
          button.setAttribute('aria-label', longDate(date) + ' at ' + time + ', checking availability');
        }
        if (slot && slot.dateKey === key(date) && slot.time === time) button.classList.add('selected');
        button.addEventListener('click', () => {
          if (button.disabled) return;
          slot = { dateKey: key(date), time };
          renderWeek();
          renderSummary();
        });
        group.appendChild(button);
      });
      week.appendChild(group);
    }

    days.forEach(date => appendTimeGroup(date, MORNING_TIME_SLOTS));
    const breakRow = document.createElement('div');
    breakRow.className = 'break-row';
    breakRow.textContent = 'BREAK';
    week.appendChild(breakRow);
    days.forEach(date => {
      const closingHour = date.getDay() === 0 ? 17 : 20;
      appendTimeGroup(date, afternoonTimeSlots(closingHour));
    });
  }

  async function loadAvailabilityForWindow(force = false) {
    if (availabilityLoading) return;
    const dates = Array.from({ length: WINDOW_DAYS }, (_, index) => key(addDays(windowStart, index)));
    if (!force && dates.every(date => loadedAvailabilityDates.has(date))) return;
    const requestedStart = dates[0];
    availabilityLoading = true;
    const message = $('availability-error');
    message.hidden = false;
    message.textContent = 'Checking the calendar for open times…';
    renderWeek();
    try {
      const { getBookedAppointmentSlots } = await import('../shared/firebase.js');
      const slots = await getBookedAppointmentSlots(dates[0], dates[dates.length - 1]);
      bookedSlotKeys.forEach(slotKey => {
        if (dates.some(date => slotKey.startsWith(date + '|'))) bookedSlotKeys.delete(slotKey);
      });
      dates.forEach(date => loadedAvailabilityDates.add(date));
      slots.forEach(booked => bookedSlotKeys.add(
        booked.date + '|' + String(booked.time || '').toUpperCase()
      ));
      message.hidden = true;
      if (slot && bookedSlotKeys.has(slot.dateKey + '|' + slot.time.toUpperCase())) {
        slot = null;
        renderSummary();
      }
    } catch (error) {
      console.error('Could not load appointment availability from the clinic calendar.', error);
      message.textContent = error.code === 'permission-denied'
        ? 'Firebase denied access to appointment availability. Publish the latest firestore.rules, including the appointmentSlots read rule.'
        : error.code === 'failed-precondition'
          ? 'Firebase needs an index for this availability query. Check the browser console for the index link.'
          : error.message || 'Could not load appointment availability. Check your Firebase connection and try again.';
    } finally {
      availabilityLoading = false;
      renderWeek();
      if (key(windowStart) !== requestedStart) loadAvailabilityForWindow();
    }
  }

  function selectCalendarDate(date) {
    windowStart = date;
    renderCalendar();
    renderWeek();
    loadAvailabilityForWindow();
  }

  function renderCalendar() {
    monthSel.value = viewMonth;
    yearSel.value = viewYear;
    $('prev-month').disabled = ym(viewYear, viewMonth) <= minYM;
    $('next-month').disabled = ym(viewYear, viewMonth) >= maxYM;

    const grid = $('cal-grid');
    grid.innerHTML = DOW.map(d => '<div class="dow">' + d + '</div>').join('');

    const first = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < first.getDay(); i++) grid.appendChild(document.createElement('span'));
    const winEnd = addDays(windowStart, WINDOW_DAYS - 1);
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(viewYear, viewMonth, day);
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = day;
      if (date >= windowStart && date <= winEnd) button.classList.add('in-week');
      if (sameDay(date, today)) button.classList.add('today');
      if (sameDay(date, windowStart)) button.classList.add('active');
      button.setAttribute('aria-label', longDate(date));
      button.addEventListener('click', () => selectCalendarDate(date));
      grid.appendChild(button);
    }
  }

  $('prev-month').addEventListener('click', () => setMonth(viewYear, viewMonth - 1));
  $('next-month').addEventListener('click', () => setMonth(viewYear, viewMonth + 1));
  monthSel.addEventListener('change', () => setMonth(viewYear, +monthSel.value));
  yearSel.addEventListener('change', () => setMonth(+yearSel.value, viewMonth));

  // ============================================================
  // CONFIRM + CONFIRMATION SCREEN
  // ============================================================
  async function confirmBooking() {
    const pet = getPet();
    if (!pet || !hasValidTreatments() || !slot) return;
    const date = fromKey(slot.dateKey);
    const serviceNames = getServiceNames();
    const totalMinutes = getTotalMinutes();
    const ref = 'PA-' + String(date.getFullYear()).slice(2) + String(date.getMonth() + 1).padStart(2, '0') +
                String(date.getDate()).padStart(2, '0') + '-' + String(Math.floor(1000 + Math.random() * 9000));
    lastBooked = await PA.addAppointment({
      ref,
      email: session.email,
      petId: pet.id, petName: pet.name, petSpecies: pet.species,
      service: serviceNames.join(', '),
      services: serviceNames,
      minutes: totalMinutes,
      date: slot.dateKey, time: slot.time,
      status: 'pending',
      createdAt: new Date().toISOString()
    });
    showConfirmation(lastBooked);
  }

  function showConfirmation(a) {
    $('flow').hidden = true;
    $('confirmation').hidden = false;
    $('confirm-title').textContent = "You're all set, " + session.firstName + '!';
    $('confirm-service').textContent = a.service;
    $('confirm-pet').textContent = a.petName + ' (' + a.petSpecies + ')';
    $('confirm-date').textContent = longDate(fromKey(a.date));
    $('confirm-time').textContent = a.time + ' · about ' + a.minutes + ' minutes';
    $('confirm-place').textContent = CLINIC.address;
    $('confirm-ref').textContent = a.ref;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  $('ics-btn').addEventListener('click', () => {
    if (!lastBooked) return;
    const a = lastBooked;
    const d = fromKey(a.date);
    const { h, m } = to24(a.time);
    const fmt = dt => dt.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const startUtc = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), h - 8, m));   // Manila = UTC+8
    const endUtc = new Date(startUtc.getTime() + a.minutes * 60000);
    const ics = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PetAppoint//EN', 'BEGIN:VEVENT',
      'UID:' + a.id + '@petappoint',
      'DTSTAMP:' + fmt(new Date()),
      'DTSTART:' + fmt(startUtc),
      'DTEND:' + fmt(endUtc),
      'SUMMARY:PetAppoint - ' + a.petName + ' ' + a.service,
      'LOCATION:' + CLINIC.name + ', ' + CLINIC.address,
      'DESCRIPTION:Booking reference ' + a.ref,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    link.download = 'petappoint-' + a.ref + '.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  });

  // ----- start -----
  renderPets();
  renderServices();
  loadCustomServices();
  goStep(1);
  window.scrollTo(0, 0);
}