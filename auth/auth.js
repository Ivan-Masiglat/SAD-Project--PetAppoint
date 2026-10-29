const PA = (() => {
  const K = {
    session: 'petappoint.session',
    pets: email => 'petappoint.pets.' + email,
    deletedPets: email => 'petappoint.deleted-pets.' + email
  };

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  async function loginAdmin(email, password) {
    const { auth, signInAdmin, signOutUser } = await import('../shared/firebase.js');
    await signOutUser();
    const user = await signInAdmin(email.trim().toLowerCase(), password);
    const session = {
      email: user.email,
      firstName: 'Admin',
      lastName: '',
      fullName: 'Admin',
      role: 'admin'
    };
    if (!write(K.session, session)) {
      await signOutUser();
      throw new Error('Could not save the admin session in this browser.');
    }
    return session;
  }

  async function registerClient({ firstName, lastName, email, phone }, password) {
    const firebase = await import('../shared/firebase.js');
    const user = await firebase.registerClient({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim()
    }, password);
    const session = {
      email: (user.email || email).toLowerCase(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      fullName: (firstName.trim() + ' ' + lastName.trim()).trim(),
      role: 'client'
    };
    if (!write(K.session, session)) {
      await firebase.signOutUser();
      throw new Error('Account created, but the browser session could not be saved.');
    }
    return session;
  }

  async function loginClient(email, password) {
    const firebase = await import('../shared/firebase.js');
    const { user, profile } = await firebase.signInClient(email.trim().toLowerCase(), password);
    const session = {
      email: (user.email || email).toLowerCase(),
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: (profile.firstName + ' ' + profile.lastName).trim(),
      role: 'client'
    };
    if (!write(K.session, session)) {
      await firebase.signOutUser();
      throw new Error('Could not save the browser session.');
    }
    return session;
  }

  function getSession() { return read(K.session, null); }

  async function logout() {
    try { localStorage.removeItem(K.session); } catch (e) {}
    const { signOutUser } = await import('../shared/firebase.js');
    await signOutUser();
  }

  function initials(session) {
    if (!session) return 'UA';
    const a = (session.firstName || '?')[0];
    const b = (session.lastName || '')[0] || (session.firstName || '')[1] || '';
    return (a + b).toUpperCase();
  }

  // Pets per user
  function getPets() {
    const s = getSession();
    if (!s || !s.email) return [];
    const email = s.email.trim().toLowerCase();
    const canonicalKey = K.pets(email);
    const matchingKeys = [];
    try {
      for (let index = 0; index < localStorage.length; index++) {
        const key = localStorage.key(index);
        if (key && key.startsWith('petappoint.pets.') &&
            key.slice('petappoint.pets.'.length).toLowerCase() === email) {
          matchingKeys.push(key);
        }
      }
    } catch (error) {
      console.error('Could not read saved pet profiles.', error);
      return read(canonicalKey, []);
    }

    const petsById = new Map();
    const petsWithoutId = [];
    matchingKeys.forEach(key => {
      const pets = read(key, []);
      if (!Array.isArray(pets)) return;
      pets.forEach(pet => {
        if (!pet || typeof pet !== 'object') return;
        if (pet.id) petsById.set(pet.id, pet);
        else petsWithoutId.push(pet);
      });
    });
    const deletedIds = read(K.deletedPets(email), []);
    const deletedPetIds = new Set(Array.isArray(deletedIds) ? deletedIds : []);
    const pets = [...petsById.values(), ...petsWithoutId]
      .filter(pet => !pet.id || !deletedPetIds.has(pet.id));
    if (matchingKeys.some(key => key !== canonicalKey) &&
        !write(canonicalKey, pets)) {
      console.error('Could not migrate saved pet profiles to the normalized account key.');
    }
    return pets;
  }
  function addPet(pet) {
    const s = getSession();
    if (!s) return null;
    const pets = getPets();
    const saved = Object.assign({ id: 'pet-' + Date.now() }, pet);
    pets.push(saved);
    return write(K.pets(s.email.trim().toLowerCase()), pets) ? saved : null;
  }
  function updatePet(id, updates) {
    const s = getSession();
    if (!s) return null;
    const pets = getPets();
    const index = pets.findIndex(pet => pet.id === id);
    if (index < 0) return null;
    pets[index] = Object.assign({}, pets[index], updates, { id });
    if (!write(K.pets(s.email.trim().toLowerCase()), pets)) return null;
    return pets[index];
  }
  function deletePet(id) {
    const s = getSession();
    if (!s || typeof id !== 'string' || !id) return false;
    const email = s.email.trim().toLowerCase();
    const pets = getPets();
    if (!pets.some(pet => pet.id === id)) return false;
    const deletedIds = read(K.deletedPets(email), []);
    const deletedPetIds = Array.isArray(deletedIds) ? deletedIds : [];
    if (!deletedPetIds.includes(id)) deletedPetIds.push(id);
    if (!write(K.deletedPets(email), deletedPetIds)) return false;
    if (!write(K.pets(email), pets.filter(pet => pet.id !== id))) {
      write(K.deletedPets(email), deletedIds);
      return false;
    }
    return true;
  }
  function restorePetsFromAppointments(appointments) {
    const s = getSession();
    if (!s || s.role !== 'client') throw new Error('Sign in with a client account to restore pet profiles.');
    const pets = getPets();
    const petIds = new Set(pets.map(pet => pet.id));
    const deletedIds = read(K.deletedPets(s.email.trim().toLowerCase()), []);
    const deletedPetIds = new Set(Array.isArray(deletedIds) ? deletedIds : []);
    let changed = false;
    (Array.isArray(appointments) ? appointments : []).forEach(appointment => {
      if (!appointment || typeof appointment.petId !== 'string' || !appointment.petId ||
          typeof appointment.petName !== 'string' || !appointment.petName.trim() ||
          petIds.has(appointment.petId) || deletedPetIds.has(appointment.petId)) return;
      pets.push({
        id: appointment.petId,
        name: appointment.petName.trim(),
        species: typeof appointment.petSpecies === 'string' ? appointment.petSpecies : '',
        breed: '',
        sex: '',
        birth: ''
      });
      petIds.add(appointment.petId);
      changed = true;
    });
    if (changed && !write(K.pets(s.email.trim().toLowerCase()), pets)) {
      throw new Error('Could not restore pet profiles from your appointments in this browser.');
    }
    return pets;
  }

  async function getMyAppointments() {
    const firebase = await import('../shared/firebase.js');
    return firebase.getClientAppointments();
  }
  async function updatePetAppointments(id, pet) {
    const firebase = await import('../shared/firebase.js');
    return firebase.updateClientPetAppointments(id, pet);
  }
  async function addAppointment(appointment) {
    const firebase = await import('../shared/firebase.js');
    return firebase.createAppointment(appointment);
  }
  return {
    loginAdmin, registerClient, loginClient, getSession, logout, initials,
    getPets, addPet, updatePet, deletePet, restorePetsFromAppointments,
    getMyAppointments, updatePetAppointments, addAppointment
  };
})();