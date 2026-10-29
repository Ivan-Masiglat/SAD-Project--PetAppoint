// ============================================================
// Home page for logged-in users
// ============================================================
const session = PA.getSession();

if (!session) {
  window.location.replace('../landingpage/landingPage.html?login=1');
} else if (session.role === 'admin') {
  window.location.replace('../admin/dashboard.html');
} else {
  document.getElementById('welcome-name').textContent = session.fullName || session.firstName;
  document.getElementById('user-name').textContent = session.fullName || session.firstName;
  document.getElementById('user-avatar').textContent = PA.initials(session);

  // Account menu (log out)
  const accountBtn = document.getElementById('account-btn');
  const menu = document.getElementById('account-menu');
  accountBtn.addEventListener('click', e => {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
    accountBtn.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', () => { menu.hidden = true; accountBtn.setAttribute('aria-expanded', 'false'); });
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try {
      await PA.logout();
      window.location.href = '../landingpage/landingPage.html';
    } catch (error) {
      console.error('Could not sign out.', error);
      window.alert('Could not sign out. Please check your connection and try again.');
    }
  });

  const petsList = document.getElementById('pets-list');
  const petsLoadError = document.getElementById('pets-load-error');
  const petDialog = document.getElementById('pet-dialog');
  const petForm = document.getElementById('pet-form');
  const speciesField = document.getElementById('other-species-field');
  let editingPetId = null;
  let viewedPetId = null;
  let clientAppointments = [];
  let appointmentsLoaded = false;

  function petAge(birth) {
    if (!birth) return '';
    const date = new Date(birth + 'T00:00:00');
    const now = new Date();
    let months = (now.getFullYear() - date.getFullYear()) * 12 + now.getMonth() - date.getMonth();
    if (now.getDate() < date.getDate()) months--;
    if (months < 0) return '';
    if (months < 12) return months + (months === 1 ? ' month' : ' months');
    const years = Math.floor(months / 12);
    return years + (years === 1 ? ' yr' : ' yrs');
  }

  function renderPets() {
    const pets = PA.getPets();
    const cards = pets.map(pet => {
      const detail = [pet.species, pet.breed, pet.sex, petAge(pet.birth)].filter(Boolean).join(' · ');
      return '<button class="pet-card" type="button" data-pet-profile="' + escapeHtml(pet.id) +
        '" aria-label="View ' + escapeHtml(pet.name) + '\'s profile"><span class="pet-card-avatar" aria-hidden="true">' +
        escapeHtml(pet.name.charAt(0).toUpperCase()) + '</span><span class="pet-card-info"><strong>' +
        escapeHtml(pet.name) + '</strong><small>' + escapeHtml(detail) +
        '</small></span><span class="pet-card-arrow" aria-hidden="true">View profile&nbsp; &rarr;</span></button>';
    });
    cards.push('<button class="empty-card add-pet-card" id="add-pet-card" type="button">' +
      '<span class="add-symbol" aria-hidden="true">+</span><span>Add a pet</span></button>');
    petsList.innerHTML = cards.join('');
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
  }

  function updateSpeciesField() {
    const isOther = petForm.elements.species.value === 'Other';
    speciesField.hidden = !isOther;
    petForm.elements.otherSpecies.required = isOther;
    if (!isOther) petForm.elements.otherSpecies.value = '';
  }

  function openPetForm(pet) {
    editingPetId = pet ? pet.id : null;
    document.getElementById('pet-profile-view').hidden = true;
    petForm.hidden = false;
    petForm.reset();
    petForm.elements.species.value = pet && ['Dog', 'Cat', 'Rabbit', 'Bird'].includes(pet.species)
      ? pet.species : pet ? 'Other' : 'Dog';
    petForm.elements.name.value = pet ? pet.name : '';
    petForm.elements.otherSpecies.value = pet && !['Dog', 'Cat', 'Rabbit', 'Bird'].includes(pet.species)
      ? pet.species : '';
    petForm.elements.sex.value = pet ? pet.sex : 'Female';
    petForm.elements.breed.value = pet ? pet.breed || '' : '';
    petForm.elements.birth.value = pet ? pet.birth || '' : '';
    const now = new Date();
    petForm.elements.birth.min = (now.getFullYear() - 100) + '-01-01';
    petForm.elements.birth.max = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    document.getElementById('pet-dialog-title').textContent = pet ? 'Edit pet' : 'Add a pet';
    petForm.querySelector('[type="submit"]').textContent = pet ? 'Save changes' : 'Save pet';
    document.getElementById('delete-pet-btn').hidden = !pet;
    updateSpeciesField();
    petDialog.hidden = false;
    petForm.elements.name.focus();
  }

  function showPetProfile(pet) {
    if (!pet) return;
    editingPetId = null;
    viewedPetId = pet.id;
    petForm.hidden = true;
    document.getElementById('pet-profile-view').hidden = false;
    document.getElementById('pet-dialog-title').textContent = pet.name + "'s profile";
    document.getElementById('pet-profile-species').textContent = pet.species || 'Not provided';
    document.getElementById('pet-profile-breed').textContent = pet.breed || 'Not provided';
    document.getElementById('pet-profile-sex').textContent = pet.sex || 'Not provided';
    document.getElementById('pet-profile-birth').textContent = pet.birth
      ? new Date(pet.birth + 'T00:00:00').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
      : 'Not provided';
    document.getElementById('pet-profile-age').textContent = petAge(pet.birth) || 'Not provided';
    petDialog.hidden = false;
    document.getElementById('edit-pet-btn').focus();
  }

  function closePetDialog() {
    petDialog.hidden = true;
    editingPetId = null;
    viewedPetId = null;
  }

  document.getElementById('add-pet-btn').addEventListener('click', () => openPetForm());
  petsList.addEventListener('click', event => {
    if (event.target.closest('#add-pet-card')) {
      openPetForm();
      return;
    }
    const petCard = event.target.closest('[data-pet-profile]');
    if (!petCard) return;
    const pet = PA.getPets().find(item => item.id === petCard.dataset.petProfile);
    if (pet) showPetProfile(pet);
  });
  document.getElementById('edit-pet-btn').addEventListener('click', () => {
    const pet = PA.getPets().find(item => item.id === viewedPetId);
    if (pet) openPetForm(pet);
  });
  document.getElementById('delete-pet-btn').addEventListener('click', () => {
    const pet = PA.getPets().find(item => item.id === editingPetId);
    if (!pet) return;
    if (!window.confirm('Delete ' + pet.name + "'s profile? Existing appointment history will be kept.")) return;
    if (!PA.deletePet(pet.id)) {
      window.alert('Could not delete the pet. Please try again.');
      return;
    }
    renderPets();
    closePetDialog();
  });
  petForm.elements.species.addEventListener('change', updateSpeciesField);
  document.getElementById('pet-close').addEventListener('click', closePetDialog);
  document.getElementById('pet-cancel').addEventListener('click', () => {
    if (editingPetId) {
      const pet = PA.getPets().find(item => item.id === editingPetId);
      if (pet) {
        showPetProfile(pet);
        return;
      }
    }
    closePetDialog();
  });
  petDialog.addEventListener('mousedown', event => {
    if (event.target === petDialog) closePetDialog();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !petDialog.hidden) closePetDialog();
  });
  petForm.addEventListener('submit', async event => {
    event.preventDefault();
    const form = event.currentTarget.elements;
    const name = form.name.value.trim();
    const birth = form.birth.value;
    const now = new Date();
    const minBirth = (now.getFullYear() - 100) + '-01-01';
    if (!name) return;
    if (birth && (birth < minBirth || birth > form.birth.max)) {
      form.birth.setCustomValidity('Enter a date within the last 100 years.');
      form.birth.reportValidity();
      form.birth.setCustomValidity('');
      return;
    }
    const species = form.species.value === 'Other' ? form.otherSpecies.value.trim() : form.species.value;
    if (!species) return;
    const pet = {
      name,
      species,
      sex: form.sex.value,
      breed: form.breed.value.trim(),
      birth
    };
    const submitButton = petForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    let saved;
    let appointmentSync;
    try {
      if (editingPetId) {
        appointmentSync = await PA.updatePetAppointments(editingPetId, pet);
        saved = PA.updatePet(editingPetId, pet);
        clientAppointments.forEach(appointment => {
          if (appointment.petId === editingPetId) {
            appointment.petName = pet.name;
            appointment.petSpecies = pet.species;
          }
        });
      } else {
        saved = PA.addPet(pet);
      }
    } catch (error) {
      console.error('Could not sync pet details to appointment history.', error);
      window.alert(error.code === 'permission-denied'
        ? 'Pet details could not be synced. Publish the latest Firestore rules, then try saving again.'
        : error.message || 'Pet details could not be synced to your appointments. Please try again.');
      submitButton.disabled = false;
      return;
    }
    submitButton.disabled = false;
    if (!saved) {
      window.alert('Could not save the pet. Please try again.');
      return;
    }
    if (editingPetId && appointmentSync?.linkedAppointments === 0) {
      window.alert('Pet profile saved, but no existing appointments are linked to this pet ID. Existing appointment details were not changed.');
    }
    renderPets();
    if (editingPetId) showPetProfile(saved);
    else closePetDialog();
  });
  renderPets();

    const featureDialogs = Array.from(document.querySelectorAll('.feature-overlay'));
    function openFeatureDialog(dialog) {
      dialog.hidden = false;
      const firstInput = dialog.querySelector('input:not([readonly]), select, textarea');
      if (firstInput) firstInput.focus();
    }
    function closeFeatureDialog(dialog) {
      dialog.hidden = true;
    }
    document.querySelectorAll('[data-close-feature]').forEach(button => {
      button.addEventListener('click', () => closeFeatureDialog(button.closest('.feature-overlay')));
    });
    featureDialogs.forEach(dialog => {
      dialog.addEventListener('mousedown', event => {
        if (event.target === dialog) closeFeatureDialog(dialog);
      });
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      const openDialog = featureDialogs.find(dialog => !dialog.hidden);
      if (openDialog) closeFeatureDialog(openDialog);
    });

    const urgentDialog = document.getElementById('urgent-dialog');
    const urgentForm = document.getElementById('urgent-form');
    const urgentPet = document.getElementById('urgent-pet');
    const urgentSlotLabel = document.getElementById('urgent-slot-label');
    const urgentError = document.getElementById('urgent-error');
    const urgentSubmit = document.getElementById('urgent-submit');
    const urgentNoPets = document.getElementById('urgent-no-pets');
    const urgentAddPet = document.getElementById('urgent-add-pet');
    function populateUrgentPets() {
      const pets = PA.getPets();
      urgentPet.innerHTML = pets.map(pet => '<option value="' + escapeHtml(pet.id) + '">' +
        escapeHtml(pet.name) + (pet.species ? ' · ' + escapeHtml(pet.species) : '') + '</option>').join('');
      urgentPet.disabled = pets.length === 0;
      urgentPet.required = pets.length > 0;
      urgentNoPets.hidden = pets.length > 0;
      urgentAddPet.hidden = pets.length > 0;
      urgentSubmit.disabled = pets.length === 0;
    }

    function dateKey(date) {
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
        String(date.getDate()).padStart(2, '0');
    }

    function timeLabel(hour) {
      return (hour % 12 || 12) + ':00 ' + (hour < 12 ? 'AM' : 'PM');
    }

    function nearestUrgentSlot(appointments, bookedSlots) {
      const now = new Date();
      const reserved = new Set(appointments
        .filter(appointment => ['pending', 'confirmed'].includes(String(appointment.status).toLowerCase()))
        .map(appointment => appointment.date + '|' + String(appointment.time || '').toUpperCase()));
      bookedSlots.forEach(slot => reserved.add(slot.date + '|' + String(slot.time || '').toUpperCase()));
      for (let offset = 0; offset < 180; offset++) {
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
        for (let hour = 0; hour < 24; hour++) {
          const time = timeLabel(hour);
          const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour);
          if (start <= now || reserved.has(dateKey(date) + '|' + time)) continue;
          return { date: dateKey(date), time, start };
        }
      }
      return null;
    }

    function displayAppointmentDate(date) {
      return date.toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
    }

    async function loadClientAppointments() {
      clientAppointments = await PA.getMyAppointments();
      appointmentsLoaded = true;
      return clientAppointments;
    }

    document.getElementById('urgent-care-btn').addEventListener('click', async () => {
      populateUrgentPets();
      urgentError.hidden = true;
      urgentSlotLabel.textContent = 'Finding the next slot…';
      urgentSubmit.disabled = PA.getPets().length === 0;
      openFeatureDialog(urgentDialog);
      try {
        const appointments = await loadClientAppointments();
        const fromDate = new Date();
        const toDate = new Date(fromDate);
        toDate.setDate(toDate.getDate() + 179);
        const from = dateKey(fromDate);
        const to = dateKey(toDate);
        const firebase = await import('../shared/firebase.js');
        const bookedSlots = await firebase.getBookedAppointmentSlots(from, to);
        let emergencyPrice = firebase.DEFAULT_SERVICES.find(service => service.id === 'emergency').price;
        try {
          const priceOverrides = await firebase.getServicePriceOverrides();
          emergencyPrice = priceOverrides.emergency ?? emergencyPrice;
        } catch (error) {
          console.error('Could not load the edited emergency-care price; showing the example price.', error);
        }
        document.getElementById('urgent-service-price').textContent =
          'Emergency Care · Approx. ' + new Intl.NumberFormat('en-PH', {
            style: 'currency', currency: 'PHP', maximumFractionDigits: 0
          }).format(emergencyPrice);
        const slot = nearestUrgentSlot(appointments, bookedSlots);
        if (!slot) {
          urgentSlotLabel.textContent = 'No future times found';
          urgentError.textContent = 'There are no clinic slots in the next 180 days. Please contact the clinic.';
          urgentError.hidden = false;
          urgentSubmit.disabled = true;
          return;
        }
        urgentSlotLabel.textContent = displayAppointmentDate(slot.start) + ' · ' + slot.time;
        urgentSubmit.disabled = PA.getPets().length === 0;
        urgentForm.dataset.date = slot.date;
        urgentForm.dataset.time = slot.time;
      } catch (error) {
        console.error('Could not find an urgent-care appointment time.', error);
        urgentSlotLabel.textContent = 'Could not load appointment availability';
        urgentError.textContent = error.code === 'permission-denied'
          ? 'Firebase denied access to appointment availability. Publish the latest firestore.rules, including the appointmentSlots read rule.'
          : error.code === 'failed-precondition'
            ? 'Firebase needs an index for this availability query. Check the browser console for the index link.'
            : error.message || 'Could not load availability. Check your Firebase connection and try again.';
        urgentError.hidden = false;
        urgentSubmit.disabled = true;
      }
    });

    urgentAddPet.addEventListener('click', () => {
      closeFeatureDialog(urgentDialog);
      openPetForm();
    });

    urgentForm.addEventListener('submit', async event => {
      event.preventDefault();
      const pet = PA.getPets().find(item => item.id === urgentPet.value);
      if (!pet) {
        urgentError.textContent = 'Add a pet profile before requesting urgent care.';
        urgentError.hidden = false;
        return;
      }
      const date = urgentForm.dataset.date;
      const time = urgentForm.dataset.time;
      if (!date || !time) {
        urgentError.textContent = 'An appointment time is not available yet. Please try again.';
        urgentError.hidden = false;
        return;
      }
      urgentSubmit.disabled = true;
      urgentError.hidden = true;
      try {
        const day = new Date(date + 'T00:00:00');
        const ref = 'PA-' + String(day.getFullYear()).slice(-2) +
          String(day.getMonth() + 1).padStart(2, '0') + String(day.getDate()).padStart(2, '0') +
          '-' + String(Math.floor(1000 + Math.random() * 9000));
        const appointment = await PA.addAppointment({
          ref,
          email: session.email,
          petId: pet.id,
          petName: pet.name,
          petSpecies: pet.species,
          service: 'Emergency Care',
          services: ['Emergency Care'],
          minutes: 30,
          date,
          time,
          status: 'pending'
        });
        clientAppointments = [Object.assign({ createdAt: new Date().toISOString() }, appointment), ...clientAppointments];
        appointmentsLoaded = true;
        renderRecentActivity(clientAppointments);
        updateNextVisit(clientAppointments);
        closeFeatureDialog(urgentDialog);
        window.alert('Urgent care request saved for ' + displayAppointmentDate(day) + ' at ' + time +
          '. The clinic must approve it before it is confirmed.');
      } catch (error) {
        console.error('Could not save urgent-care appointment.', error);
        urgentError.textContent = error.message && error.message.includes('just taken')
          ? 'The nearest time was just booked. Close and reopen Urgent care to find the next time.'
          : 'The urgent-care request could not be saved. Check your connection and try again.';
        urgentError.hidden = false;
        urgentSubmit.disabled = false;
      }
    });
  function minutes(t) {
  const [hm, ap] = t.split(' ');
  let [h, m] = hm.split(':').map(Number);
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const activityList = document.getElementById('activity-list');
  const activityEmpty = document.getElementById('activity-empty');
  function renderRecentActivity(appointments) {
    const recent = [...appointments]
      .sort((left, right) => appointmentCreatedAt(right) - appointmentCreatedAt(left))
      .slice(0, 3);
    activityEmpty.hidden = recent.length > 0;
    activityList.innerHTML = recent.map(appointment => {
      const status = String(appointment.status || 'pending').toLowerCase();
      const label = status === 'pending' ? 'Appointment requested'
        : status === 'confirmed' ? 'Appointment confirmed'
        : status === 'completed' ? 'Appointment completed'
        : status === 'cancelled' ? 'Appointment cancelled'
        : 'Appointment updated';
      const date = appointment.date
        ? new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        })
        : 'Date to be arranged';
      return '<article class="activity-item"><span class="activity-item-icon" aria-hidden="true">♡</span>' +
        '<span class="activity-item-details"><strong>' + escapeHtml(label) + '</strong><span>' +
        escapeHtml((appointment.petName || 'Your pet') + ' · ' + (appointment.service || 'Appointment')) +
        '</span><small>' + escapeHtml(date + (appointment.time ? ' · ' + appointment.time : '')) +
        '</small></span><span class="activity-item-status ' + escapeHtml(status) + '">' +
        escapeHtml(status.charAt(0).toUpperCase() + status.slice(1)) + '</span></article>';
    }).join('');
  }

  function appointmentCreatedAt(appointment) {
    const createdAt = appointment.createdAt;
    if (createdAt && typeof createdAt.toDate === 'function') return createdAt.toDate().getTime();
    if (createdAt instanceof Date) return createdAt.getTime();
    if (typeof createdAt === 'string') return Date.parse(createdAt) || 0;
    return 0;
  }

  function updateNextVisit(appointments) {
    const upcoming = appointments
      .filter(appointment => appointment.status !== 'cancelled' && appointment.status !== 'completed')
      .map(appointment => {
        const [year, month, day] = appointment.date.split('-').map(Number);
        return Object.assign({ when: new Date(year, month - 1, day) }, appointment);
      })
      .filter(appointment => appointment.when >= today)
      .sort((left, right) => left.when - right.when || minutes(left.time) - minutes(right.time))[0];

    if (upcoming) {
      const label = upcoming.when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
      document.getElementById('visit-title').textContent = label + ' · ' + upcoming.time;
      document.getElementById('visit-desc').textContent =
        upcoming.petName + ' · ' + upcoming.service + ' · ' +
        (upcoming.status === 'pending' ? 'Waiting for clinic approval' : 'Confirmed');
    }
  }

  const recordsDialog = document.getElementById('records-dialog');
  const recordsList = document.getElementById('records-list');
  const recordsMessage = document.getElementById('records-message');
  function renderRecords(appointments) {
    const history = [...appointments].sort((left, right) =>
      appointmentCreatedAt(right) - appointmentCreatedAt(left));
    if (!history.length) {
      recordsList.innerHTML = '';
      recordsMessage.textContent = 'No appointment history yet.';
      recordsMessage.hidden = false;
      return;
    }
    recordsMessage.hidden = true;
    recordsList.innerHTML = history.map(appointment => {
      const status = String(appointment.status || 'pending').toLowerCase();
      const date = appointment.date
        ? new Date(appointment.date + 'T00:00:00').toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric'
        })
        : 'Date not set';
      return '<article class="record-item"><span class="record-details"><strong>' +
        escapeHtml(appointment.petName || 'Your pet') + ' · ' +
        escapeHtml(appointment.service || 'Appointment') + '</strong><span>' +
        escapeHtml(date + (appointment.time ? ' · ' + appointment.time : '')) +
        '</span><small>Reference: ' + escapeHtml(appointment.ref || '—') +
        (appointment.minutes ? ' · About ' + escapeHtml(appointment.minutes) + ' minutes' : '') +
        '</small></span><span class="record-status ' + escapeHtml(status) + '">' +
        escapeHtml(status.charAt(0).toUpperCase() + status.slice(1)) + '</span></article>';
    }).join('');
  }

  async function openAppointmentHistory() {
    openFeatureDialog(recordsDialog);
    recordsList.innerHTML = '';
    recordsMessage.textContent = 'Loading your appointment history…';
    recordsMessage.hidden = false;
    try {
      const appointments = appointmentsLoaded ? clientAppointments : await loadClientAppointments();
      renderRecords(appointments);
    } catch (error) {
      console.error('Could not load appointment history.', error);
      recordsMessage.textContent = 'Could not load your history. Check your connection and try again.';
      recordsMessage.hidden = false;
    }
  }
  document.getElementById('medical-records-btn').addEventListener('click', openAppointmentHistory);
  document.getElementById('view-all-activity-btn').addEventListener('click', openAppointmentHistory);

  const contactDialog = document.getElementById('contact-dialog');
  const contactForm = document.getElementById('contact-form');
  document.getElementById('ask-clinic-btn').addEventListener('click', () => {
    document.getElementById('contact-email').value = session.email || '';
    document.getElementById('contact-error').hidden = true;
    openFeatureDialog(contactDialog);
  });
  contactForm.addEventListener('submit', event => {
    event.preventDefault();
    const subject = contactForm.elements.subject.value.trim();
    const message = contactForm.elements.message.value.trim();
    if (!subject || !message) return;
    const body = [
      message,
      '',
      'Client name: ' + (session.fullName || session.firstName || ''),
      'Client email: ' + (session.email || '')
    ].join('\n');
    const mailto = 'mailto:PetAppoint@vet.ph?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    window.location.href = mailto;
    closeFeatureDialog(contactDialog);
  });

  const servicesDialog = document.getElementById('services-dialog');
  const publicServiceList = document.getElementById('public-service-list');
  const publicServicesMessage = document.getElementById('public-services-message');
  document.getElementById('services-pricing-btn').addEventListener('click', async () => {
    openFeatureDialog(servicesDialog);
    publicServiceList.innerHTML = '';
    publicServicesMessage.textContent = 'Loading services and prices…';
    publicServicesMessage.hidden = false;
    try {
      const firebase = await import('../shared/firebase.js');
      const [customServices, priceOverrides] = await Promise.all([
        firebase.getServices(),
        firebase.getServicePriceOverrides()
      ]);
      const services = firebase.DEFAULT_SERVICES.concat(customServices.map(service => ({
        id: service.id,
        name: service.name,
        description: service.description,
        minutes: service.minutes,
        price: service.price
      })));
      publicServiceList.innerHTML = services.map(service => {
        const price = priceOverrides[service.id] ?? service.price;
        const priceText = Number.isFinite(price)
          ? 'Approx. ' + new Intl.NumberFormat('en-PH', {
            style: 'currency', currency: 'PHP', maximumFractionDigits: 0
          }).format(price)
          : 'Ask the clinic';
        return '<article class="public-service-item"><span class="public-service-details"><strong>' +
          escapeHtml(service.name) + '</strong><span>' + escapeHtml(service.description) +
          ' · About ' + escapeHtml(service.minutes) + ' min</span></span><span class="public-service-price">' +
          escapeHtml(priceText) + '</span></article>';
      }).join('');
      publicServicesMessage.textContent = 'Prices shown are approximate starting prices and may vary.';
      publicServicesMessage.hidden = false;
    } catch (error) {
      console.error('Could not load service catalog and pricing.', error);
      publicServicesMessage.textContent = 'Could not load the latest catalog. Check your connection and try again.';
      publicServicesMessage.hidden = false;
    }
  });

  PA.getMyAppointments().then(appointments => {
    clientAppointments = appointments;
    appointmentsLoaded = true;
    renderRecentActivity(appointments);
    try {
      PA.restorePetsFromAppointments(appointments);
      renderPets();
      petsLoadError.hidden = true;
    } catch (error) {
      console.error('Could not restore pet profiles from appointments.', error);
      petsLoadError.hidden = false;
      renderPets();
    }
    updateNextVisit(appointments);
  }).catch(error => {
    console.error('Could not load client appointments from Firestore.', error);
    document.getElementById('visit-desc').textContent = 'Could not load your appointments. Please refresh to try again.';
  });
}