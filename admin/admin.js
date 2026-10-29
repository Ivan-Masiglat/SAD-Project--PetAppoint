(() => {
  const session = typeof PA !== 'undefined' ? PA.getSession() : null;
  if (!session || session.role !== 'admin') {
    window.location.replace('../landingpage/landingPage.html?login=1&next=admin');
    return;
  }
  import('../shared/firebase.js').then(async ({ auth }) => {
    await auth.authStateReady();
    if (auth.currentUser?.email?.toLowerCase() !== session.email.toLowerCase()) {
      await PA.logout();
      window.location.replace('../landingpage/landingPage.html?login=1&next=admin');
    }
  }).catch(error => {
    console.error('Could not verify the Firebase admin session.', error);
    window.location.replace('../landingpage/landingPage.html?login=1&next=admin');
  });

  const STORAGE_KEYS = {
    accounts: 'petappoint.accounts',
    petsPrefix: 'petappoint.pets.'
  };
  const SERVICES = [
    { id: 'wellness', title: 'Wellness Check-up', minutes: 30, desc: 'Full physical exam with advice on diet, weight and routine care.', icon: '♡', price: 500 },
    { id: 'vaccination', title: 'Vaccinations', minutes: 20, desc: "Core and optional vaccines for your pet's age, species and lifestyle.", icon: '+', price: 500 },
    { id: 'dental', title: 'Dental Care', minutes: 45, desc: 'Teeth cleaning and oral checks to prevent gum disease.', icon: '✧', price: 1500 },
    { id: 'grooming', title: 'Grooming & Hygiene', minutes: 60, desc: 'Bath, trim, nail clipping and ear cleaning by gentle, trained staff.', icon: '⌁', price: 500 },
    { id: 'procedures', title: 'Minor Procedures', minutes: 60, desc: 'Spay/neuter consultations and minor procedures. Pre-op screening required.', icon: '✚', price: 5000 },
    { id: 'senior', title: 'Senior & Special Care', minutes: 40, desc: 'Gentle, accessible care plans for older pets and pets with special needs.', icon: '♡', price: 700 },
    { id: 'emergency', title: 'Emergency Care', minutes: 30, desc: 'Urgent assessment for pets that need prompt veterinary attention.', icon: '!', price: 1000 }
  ];
  const now = new Date();
  const dateLabel = document.getElementById('today-label');
  if (dateLabel) {
    dateLabel.textContent = new Intl.DateTimeFormat('en', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    }).format(now);
  }

  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      const isOpen = sidebar.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(isOpen));
    });
    document.addEventListener('click', event => {
      if (!sidebar.contains(event.target) && !menuToggle.contains(event.target)) {
        sidebar.classList.remove('open');
        menuToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  let isNavigating = false;
  function transitionTo(url) {
    if (isNavigating) return;
    isNavigating = true;
    document.body.classList.add('admin-leaving');
    window.setTimeout(() => {
      window.location.href = url;
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }
  document.querySelectorAll('a[href]:not(.logout-link)').forEach(link => {
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = new URL(link.href, window.location.href);
      if (target.origin !== window.location.origin || target.href === window.location.href) return;
      event.preventDefault();
      transitionTo(target.href);
    });
  });
  document.querySelectorAll('.logout-link').forEach(link => {
    link.addEventListener('click', async event => {
      event.preventDefault();
      try {
        await PA.logout();
        transitionTo(link.href);
      } catch (error) {
        console.error('Could not sign out of Firebase.', error);
        window.alert('Could not securely sign out. Please check your connection and try again.');
      }
    });
  });

  function readStorage(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (error) {
      console.error('Could not read PetAppoint data from local storage.', error);
      return fallback;
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  const accounts = readStorage(STORAGE_KEYS.accounts, {});
  let appointments = [];
  let safeAppointments = appointments;
  let refreshCalendar = () => {};
  let refreshClients = () => {};
  const statusOf = appointment => String(appointment.status || 'unknown').toLowerCase();
  const pendingAppointments = () => safeAppointments.filter(appointment => statusOf(appointment) === 'pending');
  const allAppointments = () => safeAppointments;
  const systemAppointments = () => safeAppointments.filter(appointment => statusOf(appointment) !== 'pending');
  const safeAccounts = accounts && typeof accounts === 'object' && !Array.isArray(accounts) ? accounts : {};
  const dateKey = date => date.getFullYear() + '-' +
    String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  const dateFromKey = key => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ''))) return null;
    const date = new Date(key + 'T00:00:00');
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const ownerFor = email => safeAccounts[String(email || '').toLowerCase()] || {};
  const ownerName = appointment => {
    const owner = ownerFor(appointment.email);
    const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ').trim();
    return name || (appointment.email ? String(appointment.email) : 'Client');
  };
  const appointmentDate = appointment => dateFromKey(appointment.date);
  const statusLabel = status => status === 'unknown'
    ? 'Unknown'
    : status.charAt(0).toUpperCase() + status.slice(1);
  const displayDate = date => new Intl.DateTimeFormat('en', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }).format(date);
  const appointmentDateTime = appointment => {
    const date = appointmentDate(appointment);
    const match = String(appointment.time || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!date || !match) return date;
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hour += 12;
    date.setHours(hour, Number(match[2]), 0, 0);
    return date;
  };

  loadAppointments().then(() => {
    updatePendingNavCount();
    renderDashboard();
    renderAppointments();
    renderCalendar();
    renderClients();
    renderServices();
  }).catch(error => {
    console.error('Could not load appointments from Firestore.', error);
    window.alert('Appointments could not be loaded from Firebase. Check your connection and Firestore rules, then reload.');
    renderDashboard();
    renderAppointments();
    renderCalendar();
    renderClients();
    renderServices();
  });

  async function loadAppointments() {
    const { getAdminAppointments, subscribeAdminAppointments } = await import('../shared/firebase.js');
    appointments = await getAdminAppointments();
    updateSafeAppointments();
    await subscribeAdminAppointments(updatedAppointments => {
      appointments = updatedAppointments;
      updateSafeAppointments();
      updatePendingNavCount();
      renderDashboard();
      renderAppointments();
      renderCalendar();
      renderClients();
    }, error => {
      console.error('Could not receive live appointment updates from Firestore.', error);
      window.alert('Live appointment updates stopped. Reload this page to reconnect.');
    });
  }

  function updateSafeAppointments() {
    safeAppointments = appointments.filter(appointment =>
      String(appointment.email || '').toLowerCase() !== session.email.toLowerCase());
  }

  function renderDashboard() {
    const todayKey = dateKey(now);
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const activeAppointments = systemAppointments().filter(appointment =>
      statusOf(appointment) !== 'cancelled' && statusOf(appointment) !== 'completed');
    const thisWeek = systemAppointments().filter(appointment => {
      const date = appointmentDate(appointment);
      return date && date >= weekStart && date < weekEnd;
    });
    const metrics = {
      pending: pendingAppointments().length,
      today: activeAppointments.filter(appointment => appointment.date === todayKey).length,
      week: thisWeek.filter(appointment =>
        statusOf(appointment) !== 'cancelled' && statusOf(appointment) !== 'completed').length,
      cancelled: thisWeek.filter(appointment => statusOf(appointment) === 'cancelled').length
    };
    document.querySelectorAll('[data-stat]').forEach(element => {
      element.textContent = String(metrics[element.dataset.stat] || 0);
    });

    const pendingList = document.getElementById('dashboard-pending-list');
    const pendingEmpty = document.getElementById('dashboard-pending-empty');
    if (pendingList && pendingEmpty) {
      const requests = pendingAppointments().slice(0, 4);
      pendingEmpty.hidden = requests.length > 0;
      pendingList.innerHTML = requests.map(appointment => {
        const date = appointmentDate(appointment);
        return '<article class="approval-request"><div class="approval-request-details"><strong>' +
          escapeHtml(appointment.petName || 'Pet visit') + '</strong><span>' +
          escapeHtml(ownerName(appointment)) + ' · ' + escapeHtml(appointment.service || 'Service not specified') +
          '</span><small>' + (date ? escapeHtml(displayDate(date)) : 'Date not set') + ' · ' +
          escapeHtml(appointment.time || 'Time TBD') + '</small></div>' +
          '<div class="appointment-actions"><button class="accept-appointment" type="button" data-appointment-status="confirmed" data-appointment-id="' +
          escapeHtml(appointment.id || '') + '">Accept</button><button class="cancel-appointment" type="button" data-appointment-status="cancelled" data-appointment-id="' +
          escapeHtml(appointment.id || '') + '">Cancel</button></div></article>';
      }).join('');
    }

    const upcomingList = document.getElementById('dashboard-upcoming-list');
    const upcomingEmpty = document.getElementById('dashboard-upcoming-empty');
    if (upcomingList && upcomingEmpty) {
      const upcoming = systemAppointments()
        .filter(appointment => statusOf(appointment) === 'confirmed')
        .map(appointment => ({ appointment, start: appointmentDateTime(appointment) }))
        .filter(item => item.start && item.start >= now)
        .sort((left, right) => left.start - right.start)
        .slice(0, 4);
      upcomingEmpty.hidden = upcoming.length > 0;
      upcomingList.innerHTML = upcoming.map(({ appointment, start }) =>
        '<article class="day-appointment"><time>' + escapeHtml(displayDate(start)) + '<br>' +
        escapeHtml(appointment.time || 'Time TBD') + '</time><div class="day-appointment-details"><strong>' +
        escapeHtml(appointment.petName || 'Pet visit') + '</strong><span>' +
        escapeHtml(ownerName(appointment)) + '</span><small>' +
        escapeHtml(appointment.service || 'Service not specified') + '</small></div></article>'
      ).join('');
    }
  }

  function updatePendingNavCount() {
    const countValue = pendingAppointments().length;
    document.querySelectorAll('#pending-nav-count').forEach(count => {
      count.textContent = String(countValue);
      count.hidden = countValue === 0;
    });
  }

  async function updateAppointmentStatus(id, nextStatus) {
    const appointment = appointments.find(item => item.id === id);
    const currentStatus = appointment ? statusOf(appointment) : '';
    const allowedTransitions = {
      pending: ['confirmed', 'cancelled'],
      confirmed: ['completed', 'cancelled']
    };
    if (!appointment || !allowedTransitions[currentStatus] || !allowedTransitions[currentStatus].includes(nextStatus)) {
      return false;
    }
    const changes = { status: nextStatus };
    if (nextStatus === 'cancelled') changes.previousStatus = currentStatus;
    else if (appointment.previousStatus !== undefined) changes.previousStatus = undefined;
    try {
      const { updateAppointment } = await import('../shared/firebase.js');
      await updateAppointment(id, changes);
    } catch (error) {
      console.error('Could not update appointment in Firestore.', error);
      return false;
    }
    Object.assign(appointment, changes);
    if (changes.previousStatus === undefined) delete appointment.previousStatus;
    updatePendingNavCount();
    renderDashboard();
    refreshCalendar();
    refreshClients();
    return true;
  }

  function renderAppointments() {
    const tbody = document.querySelector('.appointment-panel tbody');
    if (!tbody) return;
    const empty = document.querySelector('.table-empty');
    const filters = Array.from(document.querySelectorAll('.filter-chip'));
    const counts = filters.map(button => ({
      button,
      status: button.dataset.status || 'all'
    }));
    function updateCounts() {
      counts.forEach(({ button, status }) => {
        const source = status === 'all' ? allAppointments() : safeAppointments;
        const count = status === 'all' ? source.length :
          source.filter(appointment => statusOf(appointment) === status).length;
        const label = button.querySelector('span');
        if (label) label.textContent = String(count);
      });
    }
    updateCounts();

    let selectedStatus = 'pending';
    const rescheduleDialog = document.getElementById('reschedule-dialog');
    const rescheduleForm = document.getElementById('reschedule-form');
    const rescheduleDate = document.getElementById('reschedule-date');
    const rescheduleTime = document.getElementById('reschedule-time');
    const rescheduleError = document.getElementById('reschedule-error');
    let reschedulingAppointment = null;
    function updateTable() {
      const search = document.querySelector('.appointment-panel')?.dataset.search || '';
      const source = selectedStatus === 'all' ? allAppointments() : safeAppointments;
      const matching = source.filter(appointment => {
        const owner = ownerName(appointment);
        const searchText = [
          appointment.ref, owner, appointment.email, appointment.petName,
          appointment.service, appointment.time, appointment.date
        ].join(' ').toLowerCase();
        return (selectedStatus === 'all' || statusOf(appointment) === selectedStatus) &&
          searchText.includes(search);
      }).sort((left, right) => {
        const leftDate = (left.date || '') + ' ' + (left.time || '');
        const rightDate = (right.date || '') + ' ' + (right.time || '');
        return leftDate.localeCompare(rightDate);
      });

      tbody.innerHTML = matching.map(appointment => {
        const date = appointmentDate(appointment);
        const status = statusOf(appointment);
        return '<tr' + (status === 'cancelled' ? ' class="appointment-cancelled"' : '') +
          '><td><strong>' + escapeHtml(appointment.ref || '—') + '</strong></td>' +
          '<td>' + escapeHtml(ownerName(appointment)) + '<small class="cell-subtext">' +
          escapeHtml(appointment.email || '') + '</small></td>' +
          '<td>' + escapeHtml(appointment.petName || '—') +
          (appointment.petSpecies ? '<small class="cell-subtext">' + escapeHtml(appointment.petSpecies) + '</small>' : '') + '</td>' +
          '<td>' + escapeHtml(appointment.service || '—') + '</td>' +
          '<td>' + (date ? escapeHtml(displayDate(date)) : 'Date not set') +
          '<small class="cell-subtext">' + escapeHtml(appointment.time || '') + '</small></td>' +
          '<td><span class="status-badge status-' + escapeHtml(status) + '">' +
          escapeHtml(statusLabel(status)) + '</span></td>' +
          '<td>' + appointmentActions(appointment) + '</td></tr>';
      }).join('');
      if (empty) {
        empty.hidden = matching.length > 0;
        const title = empty.querySelector('strong');
        const detail = empty.querySelector('p');
        if (title) title.textContent = source.length
          ? 'No matching appointments'
          : selectedStatus === 'pending' ? 'No pending requests' : 'No appointments yet';
        if (detail) detail.textContent = source.length
          ? 'Try another search or status filter.'
          : selectedStatus === 'pending'
            ? 'New client booking requests will appear here for approval.'
            : 'Accepted bookings will appear here once approved by the clinic.';
      }
    }

    tbody.addEventListener('click', async event => {
      const reopenButton = event.target.closest('[data-reschedule-appointment]');
      if (reopenButton && rescheduleDialog && rescheduleDate && rescheduleTime) {
        reschedulingAppointment = appointments.find(item => item.id === reopenButton.dataset.rescheduleAppointment);
        if (!reschedulingAppointment || statusOf(reschedulingAppointment) !== 'cancelled') return;
        rescheduleDate.value = reschedulingAppointment.date || '';
        rescheduleTime.value = appointmentTimeInput(reschedulingAppointment.time);
        if (rescheduleError) rescheduleError.hidden = true;
        rescheduleDialog.showModal();
        return;
      }
      const button = event.target.closest('[data-appointment-status]');
      if (!button) return;
      button.disabled = true;
      if (await updateAppointmentStatus(button.dataset.appointmentId, button.dataset.appointmentStatus)) {
        selectedStatus = 'all';
        filters.forEach(filter => {
          const selected = filter.dataset.status === 'all';
          filter.classList.toggle('selected', selected);
          filter.setAttribute('aria-selected', String(selected));
        });
        updateCounts();
        updateTable();
      } else {
        button.textContent = 'Try again';
        button.disabled = false;
      }
    });

    if (rescheduleForm && rescheduleDialog && rescheduleDate && rescheduleTime) {
      rescheduleForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!reschedulingAppointment || statusOf(reschedulingAppointment) !== 'cancelled') return;
        const oldPreviousStatus = reschedulingAppointment.previousStatus;
        const restoredStatus = oldPreviousStatus === 'pending' ? 'pending' : 'confirmed';
        const changes = {
          date: rescheduleDate.value,
          time: displayAppointmentTime(rescheduleTime.value),
          status: restoredStatus,
          previousStatus: undefined
        };
        try {
          const { updateAppointment } = await import('../shared/firebase.js');
          await updateAppointment(reschedulingAppointment.id, changes);
        } catch (error) {
          console.error('Could not reopen appointment in Firestore.', error);
          if (rescheduleError) rescheduleError.hidden = false;
          return;
        }
        Object.assign(reschedulingAppointment, changes);
        delete reschedulingAppointment.previousStatus;
        rescheduleDialog.close();
        reschedulingAppointment = null;
        selectedStatus = 'all';
        filters.forEach(filter => {
          const selected = filter.dataset.status === 'all';
          filter.classList.toggle('selected', selected);
          filter.setAttribute('aria-selected', String(selected));
        });
        updatePendingNavCount();
        updateCounts();
        updateTable();
        renderDashboard();
        refreshCalendar();
        refreshClients();
      });
      document.getElementById('reschedule-cancel')?.addEventListener('click', () => {
        rescheduleDialog.close();
        reschedulingAppointment = null;
      });
      rescheduleDialog.addEventListener('click', event => {
        if (event.target === rescheduleDialog) rescheduleDialog.close();
      });
    }

    filters.forEach(button => button.addEventListener('click', () => {
      filters.forEach(filter => {
        const selected = filter === button;
        filter.classList.toggle('selected', selected);
        filter.setAttribute('aria-selected', String(selected));
      });
      selectedStatus = button.dataset.status || 'all';
      updateTable();
    }));
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) searchInput.addEventListener('input', () => {
      document.querySelector('.appointment-panel').dataset.search = searchInput.value.trim().toLowerCase();
      updateTable();
    });
    updateTable();
  }

  const dashboardPendingList = document.getElementById('dashboard-pending-list');
  if (dashboardPendingList) {
    dashboardPendingList.addEventListener('click', async event => {
      const button = event.target.closest('[data-appointment-status]');
      if (!button) return;
      button.disabled = true;
      if (!await updateAppointmentStatus(button.dataset.appointmentId, button.dataset.appointmentStatus)) {
        button.textContent = 'Try again';
        button.disabled = false;
      }
    });
  }

  function appointmentActions(appointment) {
    const id = escapeHtml(appointment.id || '');
    const status = statusOf(appointment);
    if (status === 'pending') {
      return '<div class="appointment-actions"><button class="accept-appointment" type="button" data-appointment-status="confirmed" data-appointment-id="' +
        id + '">Accept</button><button class="cancel-appointment" type="button" data-appointment-status="cancelled" data-appointment-id="' +
        id + '">Cancel</button></div>';
    }
    if (status === 'confirmed') {
      return '<div class="appointment-actions"><button class="complete-appointment" type="button" data-appointment-status="completed" data-appointment-id="' +
        id + '">Complete</button><button class="cancel-appointment" type="button" data-appointment-status="cancelled" data-appointment-id="' +
        id + '">Cancel</button></div>';
    }
    if (status === 'cancelled') {
      return '<button class="reopen-appointment" type="button" data-reschedule-appointment="' +
        id + '">Reopen &amp; edit time</button>';
    }
    return '—';
  }

  function appointmentTimeInput(value) {
    const match = String(value || '').match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!match) return '';
    let hour = Number(match[1]) % 12;
    if (match[3].toUpperCase() === 'PM') hour += 12;
    return String(hour).padStart(2, '0') + ':' + match[2];
  }

  function displayAppointmentTime(value) {
    const [hourText, minute] = value.split(':');
    const hour = Number(hourText);
    return (hour % 12 || 12) + ':' + minute + (hour < 12 ? ' AM' : ' PM');
  }

  function renderCalendar() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    const monthLabel = document.getElementById('calendar-month-label');
    const selectedLabel = document.getElementById('selected-date-label');
    const selectedCount = document.getElementById('selected-date-count');
    const dayList = document.getElementById('day-appointments');
    const monthCount = document.getElementById('month-appointment-count');
    const nextAppointmentButton = document.getElementById('calendar-next-appointment');
    let viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
    let selectedKey = dateKey(now);

    function nextConfirmedAppointment() {
      return systemAppointments()
        .filter(appointment => statusOf(appointment) === 'confirmed')
        .map(appointment => ({ appointment, start: appointmentDateTime(appointment) }))
        .filter(item => item.start && item.start >= now)
        .sort((left, right) => left.start - right.start)[0] || null;
    }

    function appointmentsFor(key) {
      return systemAppointments().filter(appointment => appointment.date === key)
        .sort((left, right) => String(left.time || '').localeCompare(String(right.time || '')));
    }

    function renderDay() {
      const selectedDate = dateFromKey(selectedKey);
      const items = appointmentsFor(selectedKey);
      selectedLabel.textContent = selectedDate ? displayDate(selectedDate) : 'Selected date';
      selectedCount.textContent = items.length + (items.length === 1 ? ' appointment' : ' appointments');
      const search = document.querySelector('.search-box input')?.value.trim().toLowerCase() || '';
      const visible = items.filter(appointment => [
        ownerName(appointment), appointment.email, appointment.petName, appointment.service,
        appointment.ref, appointment.time
      ].join(' ').toLowerCase().includes(search));
      if (!visible.length) {
        dayList.innerHTML = '<div class="empty-state day-empty"><span class="empty-illustration calendar-mark" aria-hidden="true">▦</span><strong>' +
          (items.length ? 'No matching appointments' : 'No visits scheduled') +
          '</strong><p>' + (items.length ? 'Try another search term.' : 'Choose another date or check back when a visit is booked.') + '</p></div>';
        return;
      }
      dayList.innerHTML = visible.map(appointment => {
        const status = statusOf(appointment);
        return '<article class="day-appointment' + (status === 'cancelled' ? ' appointment-cancelled' : '') +
          '"><time>' + escapeHtml(appointment.time || 'Time TBD') + '</time>' +
          '<div class="day-appointment-details"><strong>' + escapeHtml(appointment.petName || 'Pet visit') + '</strong>' +
          '<span>' + escapeHtml(ownerName(appointment)) + '</span><small>' +
          escapeHtml(appointment.service || 'Service not specified') + '</small><small>Ref ' +
          escapeHtml(appointment.ref || '—') + '</small></div><span class="status-badge status-' +
          escapeHtml(status) + '">' + escapeHtml(statusLabel(status)) + '</span></article>';
      }).join('');
    }

    function renderMonth() {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const first = new Date(year, month, 1);
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const monthAppointments = systemAppointments().filter(appointment => {
        const date = appointmentDate(appointment);
        return date && date.getFullYear() === year && date.getMonth() === month;
      });
      const nextAppointment = nextConfirmedAppointment();
      if (nextAppointmentButton) {
        nextAppointmentButton.hidden = !nextAppointment;
        if (nextAppointment) {
          nextAppointmentButton.textContent = 'Next visit · ' +
            new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(nextAppointment.start);
        }
      }
      monthLabel.textContent = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(first);
      monthCount.textContent = monthAppointments.length + (monthAppointments.length === 1 ? ' appointment this month' : ' appointments this month');
      const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      grid.innerHTML = weekdays.map(day => '<span class="month-weekday">' + day + '</span>').join('');
      for (let blank = 0; blank < first.getDay(); blank++) {
        grid.insertAdjacentHTML('beforeend', '<span class="month-blank" aria-hidden="true"></span>');
      }
      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const key = dateKey(date);
        const count = appointmentsFor(key).length;
        const classes = [
          'month-day',
          key === dateKey(now) ? 'is-today' : '',
          key === selectedKey ? 'is-selected' : ''
        ].filter(Boolean).join(' ');
        grid.insertAdjacentHTML('beforeend', '<button type="button" class="' + classes +
          '" data-date="' + key + '" aria-pressed="' + (key === selectedKey) +
          '" aria-label="' + escapeHtml(displayDate(date)) + ', ' + count +
          (count === 1 ? ' appointment' : ' appointments') + '">' +
          '<span>' + day + '</span>' + (count ? '<i class="appointment-dot" aria-hidden="true"></i><small>' + count + '</small>' : '') +
          '</button>');
      }
      grid.querySelectorAll('[data-date]').forEach(button => button.addEventListener('click', () => {
        selectedKey = button.dataset.date;
        renderMonth();
        renderDay();
      }));
    }

    document.getElementById('calendar-prev').addEventListener('click', () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1);
      selectedKey = dateKey(viewDate);
      renderMonth();
      renderDay();
    });
    document.getElementById('calendar-next').addEventListener('click', () => {
      viewDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
      selectedKey = dateKey(viewDate);
      renderMonth();
      renderDay();
    });
    document.getElementById('calendar-today').addEventListener('click', () => {
      viewDate = new Date(now.getFullYear(), now.getMonth(), 1);
      selectedKey = dateKey(now);
      renderMonth();
      renderDay();
    });
    if (nextAppointmentButton) {
      nextAppointmentButton.addEventListener('click', () => {
        const nextAppointment = nextConfirmedAppointment();
        if (!nextAppointment) return;
        viewDate = new Date(nextAppointment.start.getFullYear(), nextAppointment.start.getMonth(), 1);
        selectedKey = dateKey(nextAppointment.start);
        renderMonth();
        renderDay();
      });
    }
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) searchInput.addEventListener('input', renderDay);
    refreshCalendar = () => {
      renderMonth();
      renderDay();
    };
    renderMonth();
    renderDay();
  }

  function renderClients() {
    const list = document.getElementById('client-list');
    if (!list) return;
    let remoteClients = [];
    const searchInput = document.getElementById('client-search');

    function updateClients() {
      const localClients = Object.keys(safeAccounts).map(email => {
        const account = safeAccounts[email] || {};
        return {
          email: String(account.email || email).toLowerCase(),
          firstName: account.firstName || '',
          lastName: account.lastName || '',
          phone: account.phone || ''
        };
      });
      const byEmail = new Map(localClients.map(client => [client.email, client]));
      remoteClients.forEach(client => byEmail.set(String(client.email || '').toLowerCase(), client));
      const clients = Array.from(byEmail.values()).map(account => {
        const clientEmail = account.email;
        const savedPets = readStorage(STORAGE_KEYS.petsPrefix + clientEmail, []);
        const petsById = new Map(
          (Array.isArray(savedPets) ? savedPets : [])
            .filter(pet => pet && typeof pet === 'object')
            .map(pet => [pet.id || [pet.name, pet.species].join('|'), pet])
        );
        appointments
          .filter(appointment =>
            String(appointment.email || '').toLowerCase() === clientEmail &&
            typeof appointment.petName === 'string' && appointment.petName.trim())
          .forEach(appointment => {
            const petId = appointment.petId ||
              [appointment.petName.trim().toLowerCase(), String(appointment.petSpecies || '').toLowerCase()].join('|');
            const savedPet = petsById.get(petId) || {};
            petsById.set(petId, Object.assign({}, savedPet, {
              id: appointment.petId || savedPet.id,
              name: appointment.petName,
              species: appointment.petSpecies || savedPet.species || ''
            }));
          });
        const pets = Array.from(petsById.values());
        return {
          email: clientEmail,
          name: [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || clientEmail,
          phone: account.phone || '',
          pets: Array.isArray(pets) ? pets : [],
          visits: systemAppointments().filter(appointment =>
            String(appointment.email || '').toLowerCase() === clientEmail).length
        };
      }).sort((left, right) => left.name.localeCompare(right.name));
      const petCount = clients.reduce((total, client) => total + client.pets.length, 0);
      document.getElementById('client-total').textContent = String(clients.length);
      document.getElementById('pet-total').textContent = String(petCount);
      const search = searchInput.value.trim().toLowerCase();
      const matching = clients.filter(client => [
        client.name, client.email, client.phone,
        ...client.pets.flatMap(pet => [pet.name, pet.species, pet.breed])
      ].join(' ').toLowerCase().includes(search));
      if (!matching.length) {
        list.innerHTML = '<div class="empty-state directory-empty"><span class="empty-illustration paw-mark" aria-hidden="true">♡</span><strong>' +
          (clients.length ? 'No matching clients or pets' : 'No clients yet') + '</strong><p>' +
          (clients.length ? 'Try searching by a different name, email, or pet.' : 'Client accounts and pet profiles will appear here as they register.') +
          '</p></div>';
        return;
      }
      list.innerHTML = matching.map(client => '<article class="panel client-card"><div class="client-card-heading">' +
        '<span class="client-avatar">' + escapeHtml(client.name.charAt(0).toUpperCase()) + '</span><div><h2>' +
        escapeHtml(client.name) + '</h2><p>' + escapeHtml(client.email) + '</p></div></div>' +
        (client.phone ? '<p class="client-phone">☎ ' + escapeHtml(client.phone) + '</p>' : '') +
        '<div class="client-meta"><span>' + client.pets.length + (client.pets.length === 1 ? ' pet' : ' pets') +
        '</span><span>' + client.visits + (client.visits === 1 ? ' visit' : ' visits') + '</span></div>' +
        '<div class="pet-list">' + (client.pets.length ? client.pets.map(pet =>
          '<div class="pet-row"><span class="pet-avatar" aria-hidden="true">♡</span><div><strong>' +
          escapeHtml(pet.name || 'Unnamed pet') + '</strong><small>' +
          escapeHtml([pet.species, pet.breed, pet.sex].filter(Boolean).join(' · ') || 'Pet details not provided') +
          '</small></div></div>').join('') : '<p class="no-pets">No pet profiles yet.</p>') +
        '</div></article>').join('');
    }
    if (searchInput) searchInput.addEventListener('input', updateClients);
    refreshClients = updateClients;
    updateClients();
    import('../shared/firebase.js').then(firebase => firebase.getClientProfiles()).then(profiles => {
      remoteClients = profiles;
      updateClients();
    }).catch(error => {
      console.error('Could not load client profiles from Firestore.', error);
    });
  }

  function renderServices() {
    const list = document.getElementById('service-list');
    if (!list) return;
    const searchInput = document.getElementById('service-search');
    const form = document.getElementById('service-form');
    const formMessage = document.getElementById('service-form-message');
    const loadMessage = document.getElementById('service-load-message');
    let remoteServices = [];
    let priceOverrides = {};
    function updateServices() {
      const search = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const allServices = SERVICES.map(service => ({
        ...service,
        price: priceOverrides[service.id] ?? service.price,
        custom: false
      })).concat(remoteServices);
      const matching = allServices.filter(service =>
        (service.title + ' ' + service.desc).toLowerCase().includes(search));
      if (!matching.length) {
        list.innerHTML = '<div class="empty-state directory-empty"><strong>' +
          (allServices.length ? 'No matching services' : 'No services available') +
          '</strong><p>' + (allServices.length ? 'Try a different search.' : 'Add a service to make it available for booking.') + '</p></div>';
        return;
      }
      list.innerHTML = matching.map(service => '<article class="panel service-card"><span class="service-icon" aria-hidden="true">' +
        escapeHtml(service.icon) + '</span><div class="service-card-title"><h2>' + escapeHtml(service.title) +
        '</h2><span class="duration-pill">About ' + service.minutes + ' min</span></div><p>' +
        escapeHtml(service.desc) + '</p><label class="service-price-editor">Approx. price (PHP)<span><span>₱</span><input type="number" min="0" max="1000000" step="1" value="' +
        escapeHtml(service.price ?? '') + '" data-service-price="' + escapeHtml(service.id) + '" aria-label="Price for ' +
        escapeHtml(service.title) + '"></span></label><div class="service-card-footer"><span class="service-availability"><i></i> Available for booking</span>' +
        '<button class="save-service-price" type="button" data-save-service-price="' + escapeHtml(service.id) +
        '" data-custom="' + String(Boolean(service.custom)) + '">Save price</button><small class="price-save-message" data-price-message="' +
        escapeHtml(service.id) + '" role="status"></small></div></article>').join('');
    }
    if (searchInput) searchInput.addEventListener('input', updateServices);
    if (form) {
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const submit = form.querySelector('[type="submit"]');
        const values = new FormData(form);
        const service = {
          name: String(values.get('name') || '').trim(),
          minutes: Number(values.get('minutes')),
          description: String(values.get('description') || '').trim(),
          price: Number(values.get('price'))
        };
        if (!service.name || !service.description ||
            !Number.isInteger(service.minutes) || service.minutes < 1 || service.minutes > 1440 ||
            !Number.isFinite(service.price) || service.price < 0 || service.price > 1000000) {
          if (formMessage) formMessage.textContent = 'Enter a name, description, valid duration, and price from ₱0 to ₱1,000,000.';
          return;
        }
        submit.disabled = true;
        if (formMessage) formMessage.textContent = 'Saving service…';
        try {
          const firebase = await import('../shared/firebase.js');
          const reference = await firebase.addService(service);
          remoteServices.push({
            id: reference.id,
            title: service.name,
            minutes: service.minutes,
            desc: service.description,
            price: service.price,
            custom: true,
            icon: '♡'
          });
          form.reset();
          updateServices();
          if (formMessage) formMessage.textContent = 'Service added and available for booking.';
        } catch (error) {
          console.error('Could not add service to Firestore.', error);
          if (formMessage) formMessage.textContent =
            'Could not save the service. Check your admin sign-in and Firestore rules, then try again.';
        } finally {
          submit.disabled = false;
        }
      });
    }
    list.addEventListener('click', async event => {
      const button = event.target.closest('[data-save-service-price]');
      if (!button) return;
      const serviceId = button.dataset.saveServicePrice;
      const input = list.querySelector('[data-service-price="' + CSS.escape(serviceId) + '"]');
      const message = list.querySelector('[data-price-message="' + CSS.escape(serviceId) + '"]');
      const price = input ? Number(input.value) : NaN;
      if (!Number.isFinite(price) || price < 0 || price > 1000000) {
        if (message) message.textContent = 'Enter a price from ₱0 to ₱1,000,000.';
        return;
      }
      button.disabled = true;
      if (message) message.textContent = 'Saving…';
      try {
        const firebase = await import('../shared/firebase.js');
        await firebase.setServicePrice(serviceId, price, button.dataset.custom === 'true');
        if (button.dataset.custom === 'true') {
          const service = remoteServices.find(item => item.id === serviceId);
          if (service) service.price = price;
        } else {
          priceOverrides[serviceId] = price;
        }
        if (message) message.textContent = 'Saved';
        updateServices();
      } catch (error) {
        console.error('Could not save service price to Firestore.', error);
        if (message) message.textContent = 'Could not save. Check the published Firestore rules.';
      } finally {
        button.disabled = false;
      }
    });
    updateServices();
    import('../shared/firebase.js').then(async firebase => {
      const [services, overrides] = await Promise.all([
        firebase.getServices(),
        firebase.getServicePriceOverrides()
      ]);
      priceOverrides = overrides;
      remoteServices = services.map(service => ({
        id: service.id,
        title: service.name,
        minutes: service.minutes,
        desc: service.description,
        price: service.price,
        custom: true,
        icon: '♡'
      }));
      updateServices();
    }).catch(error => {
      console.error('Could not load services from Firestore.', error);
      if (loadMessage) {
        loadMessage.hidden = false;
        loadMessage.textContent = 'Custom services could not be loaded. Check Firestore access and try refreshing.';
      }
    });
  }
})();
