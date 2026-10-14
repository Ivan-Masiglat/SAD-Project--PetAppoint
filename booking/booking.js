const DEMO_TODAY = null;

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

// Time slots shown in each day column. Edit freely.
const TIME_SLOTS = [
  '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '12:30 PM',
  '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
];

// Days the clinic is closed (0 = Sunday ... 6 = Saturday)
const CLOSED_DAYS = [0];

// TEMPORARY: until there is a database, some slots are simulated as "already
// taken" so the grid looks like the design. Real bookings made on this page
// are also blocked (see PA.isSlotBooked). Replace with a server lookup later.
function isSimulatedTaken(date, slotIndex) {
  const seed = date.getFullYear() * 1000 + date.getMonth() * 50 + date.getDate();
  return ((seed * 31 + slotIndex * 17) % 7) === 0;
}

// ============================================================
// LOGIN GUARD - booking is only for logged-in users
// ============================================================
const session = PA.getSession();
if (!session) {
  location.replace('../landingpage/landingPage.html?login=1&next=booking');
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

  const $ = id => document.getElementById(id);
  const svg = inner => '<svg viewBox="0 0 24 24" aria-hidden="true">' + inner + '</svg>';
  const CHECK = svg('<path d="m5 12 4 4L19 6"/>');

  const now = DEMO_TODAY ? new Date(DEMO_TODAY + 'T00:00:00') : new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ----- state -----
  let step = 1;
  let petId = null;
  let serviceId = null;
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
    if (months < 12) return months + (months === 1 ? ' mo' : ' mos');
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
  const getService = () => SERVICES.find(s => s.id === serviceId);

  // ----- header -----
  $('user-avatar').textContent = PA.initials(session);
  $('user-name').textContent = session.fullName || session.firstName;
  $('logout-btn').addEventListener('click', () => {
    PA.logout();
    location.href = '../landingpage/landingPage.html';
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
    if (n === 3) { renderCalendar(); renderWeek(); }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderSummary() {
    const pet = getPet(), svc = getService();
    let text = 'Choose a pet to begin';
    if (pet) {
      if (step === 1) text = pet.name;
      else if (step === 2) text = pet.name + ' · ' + (svc ? svc.title : 'choose a treatment');
      else text = pet.name + ' · ' + (svc ? svc.title : '') + ' · ' +
                  (slot ? shortDate(fromKey(slot.dateKey)) + ', ' + slot.time : 'choose a date and time');
    }
    $('summary-text').textContent = text;

    const next = $('next-btn');
    if (step === 1) { next.innerHTML = 'Continue &rarr;'; next.disabled = !pet; }
    if (step === 2) { next.innerHTML = 'Continue &rarr;'; next.disabled = !svc; }
    if (step === 3) { next.innerHTML = 'Confirm appointment &rarr;'; next.disabled = !slot; }
    $('back-btn').innerHTML = step === 1 ? '&larr; Back to home' : '&larr; Back';
  }

  $('back-btn').addEventListener('click', () => {
    if (step === 1) location.href = '../homepage/Homepage.html';
    else goStep(step - 1);
  });
  $('next-btn').addEventListener('click', () => {
    if (step === 1 && petId) goStep(2);
    else if (step === 2 && serviceId) goStep(3);
    else if (step === 3 && slot) confirmBooking();
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
    dlg.hidden = false;
    $('pet-form').elements.name.focus();
  }
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
    const saved = PA.addPet({
      name, species: f.species.value, sex: f.sex.value,
      breed: f.breed.value.trim(), birth: f.birth.value
    });
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
    $('service-list').innerHTML = SERVICES.map(s =>
      '<button type="button" class="choice' + (s.id === serviceId ? ' selected' : '') + '" data-service="' + s.id + '">' +
      '<span class="ico">' + svg(s.icon) + '</span>' +
      '<span class="txt"><b>' + s.title + '</b><small>' + s.desc + '</small><span class="mins">About ' + s.minutes + ' min</span></span>' +
      '<span class="tick">' + CHECK + '</span></button>').join('');
  }
  $('service-list').addEventListener('click', e => {
    const card = e.target.closest('[data-service]');
    if (!card) return;
    serviceId = card.dataset.service;
    renderServices();
    renderSummary();
  });

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
    renderCalendar();
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
      const d = new Date(viewYear, viewMonth, day);
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = day;
      b.disabled = d < today;
      if (d >= windowStart && d <= winEnd) b.classList.add('in-week');
      if (sameDay(d, today)) b.classList.add('today');
      if (sameDay(d, windowStart)) b.classList.add('active');
      b.setAttribute('aria-label', longDate(d));
      b.addEventListener('click', () => {
        windowStart = d;
        renderCalendar();
        renderWeek();
      });
      grid.appendChild(b);
    }
  }

  function isUnavailable(date, idx) {
    const time = TIME_SLOTS[idx];
    if (date < today || CLOSED_DAYS.includes(date.getDay())) return true;
    if (sameDay(date, today) && !DEMO_TODAY) {            // today's slots that already passed
      const { h, m } = to24(time);
      if (h * 60 + m <= now.getHours() * 60 + now.getMinutes()) return true;
    }
    return isSimulatedTaken(date, idx) || PA.isSlotBooked(key(date), time);
  }

  function renderWeek() {
    const week = $('week');
    week.innerHTML = '';
    for (let i = 0; i < WINDOW_DAYS; i++) {
      const d = addDays(windowStart, i);
      const closed = d < today || CLOSED_DAYS.includes(d.getDay());

      const col = document.createElement('div');
      col.className = 'day' + (closed ? ' closed' : '');
      col.innerHTML = '<div class="day-head"><div class="name">' + DOW_SHORT[d.getDay()] + '</div>' +
                      '<div class="num">' + String(d.getDate()).padStart(2, '0') + '</div></div>';

      TIME_SLOTS.forEach((time, idx) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'slot';
        b.textContent = time;
        b.disabled = isUnavailable(d, idx);
        b.setAttribute('aria-label', longDate(d) + ' at ' + time + (b.disabled ? ' (unavailable)' : ''));
        if (slot && slot.dateKey === key(d) && slot.time === time) b.classList.add('selected');
        b.addEventListener('click', () => {
          slot = { dateKey: key(d), time };
          renderWeek();
          renderSummary();
        });
        col.appendChild(b);
      });
      week.appendChild(col);
    }
  }

  $('prev-month').addEventListener('click', () => setMonth(viewYear, viewMonth - 1));
  $('next-month').addEventListener('click', () => setMonth(viewYear, viewMonth + 1));
  monthSel.addEventListener('change', () => setMonth(viewYear, +monthSel.value));
  yearSel.addEventListener('change', () => setMonth(+yearSel.value, viewMonth));

  // ============================================================
  // CONFIRM + CONFIRMATION SCREEN
  // ============================================================
  function confirmBooking() {
    const pet = getPet(), svc = getService();
    if (!pet || !svc || !slot) return;
    const date = fromKey(slot.dateKey);
    const idx = TIME_SLOTS.indexOf(slot.time);
    if (isUnavailable(date, idx)) {                       // someone took it meanwhile
      toast('Sorry, that time was just taken. Please pick another.');
      slot = null;
      renderWeek();
      renderSummary();
      return;
    }
    const ref = 'PA-' + String(date.getFullYear()).slice(2) + String(date.getMonth() + 1).padStart(2, '0') +
                String(date.getDate()).padStart(2, '0') + '-' + String(Math.floor(1000 + Math.random() * 9000));
    lastBooked = PA.addAppointment({
      id: 'appt-' + Date.now(),
      ref,
      email: session.email,
      petId: pet.id, petName: pet.name, petSpecies: pet.species,
      service: svc.title, minutes: svc.minutes,
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
  goStep(1);
  window.scrollTo(0, 0);
}