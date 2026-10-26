// ============================================================
// Home page for logged-in users
// ============================================================
const session = PA.getSession();

if (!session) {
  window.location.replace('../landingpage/landingPage.html?login=1');
} else {
  document.getElementById('welcome-name').textContent = session.firstName;
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
  document.getElementById('logout-btn').addEventListener('click', () => {
    PA.logout();
    window.location.href = '../landingpage/landingPage.html';
  });

  const petsList = document.getElementById('pets-list');
  const petDialog = document.getElementById('pet-dialog');
  const petForm = document.getElementById('pet-form');
  const speciesField = document.getElementById('other-species-field');
  let editingPetId = null;
  let viewedPetId = null;

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
  petForm.addEventListener('submit', event => {
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
    const saved = editingPetId ? PA.updatePet(editingPetId, pet) : PA.addPet(pet);
    if (!saved) {
      window.alert('Could not save the pet. Please try again.');
      return;
    }
    renderPets();
    if (editingPetId) showPetProfile(saved);
    else closePetDialog();
  });

  renderPets();

  function minutes(t) {
  const [hm, ap] = t.split(' ');
  let [h, m] = hm.split(':').map(Number);
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + m;
}

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const upcoming = PA.getMyAppointments()
    .filter(a => a.status !== 'cancelled')
    .map(a => {
      const [y, m, d] = a.date.split('-').map(Number);
      return Object.assign({ when: new Date(y, m - 1, d) }, a);
    })
    .filter(a => a.when >= today)
    .sort((a, b) => a.when - b.when || minutes(a.time) - minutes(b.time))[0];

  if (upcoming) {
    const label = upcoming.when.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    document.getElementById('visit-title').textContent = label + ' · ' + upcoming.time;
    document.getElementById('visit-desc').textContent =
      upcoming.petName + ' · ' + upcoming.service + ' · ' +
      (upcoming.status === 'pending' ? 'Waiting for clinic approval' : 'Confirmed');
  }
}