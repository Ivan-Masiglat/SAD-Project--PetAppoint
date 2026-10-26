const PA = (() => {
  const K = {
    session: 'petappoint.session',
    accounts: 'petappoint.accounts',
    appointments: 'petappoint.appointments',
    pets: email => 'petappoint.pets.' + email
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

  function titleCase(s) {
    return s.replace(/[._-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
  }

  // Accounts & session
  function saveAccount({ firstName, lastName, email, phone }) {
    const accounts = read(K.accounts, {});
    accounts[email.toLowerCase()] = { firstName, lastName, email: email.toLowerCase(), phone };
    write(K.accounts, accounts);
  }

  function login(email) {
    email = email.trim().toLowerCase();
    const acct = read(K.accounts, {})[email];
    const firstName = acct ? acct.firstName : titleCase(email.split('@')[0]).split(' ')[0];
    const lastName = acct ? acct.lastName : '';
    const session = { email, firstName, lastName, fullName: (firstName + ' ' + lastName).trim() };
    write(K.session, session);
    return session;
  }

  function getSession() { return read(K.session, null); }

  function logout() {
    try { localStorage.removeItem(K.session); } catch (e) {}
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
    return s ? read(K.pets(s.email), []) : [];
  }
  function addPet(pet) {
    const s = getSession();
    if (!s) return null;
    const pets = getPets();
    const saved = Object.assign({ id: 'pet-' + Date.now() }, pet);
    pets.push(saved);
    return write(K.pets(s.email), pets) ? saved : null;
  }
  function updatePet(id, updates) {
    const s = getSession();
    if (!s) return null;
    const pets = getPets();
    const index = pets.findIndex(pet => pet.id === id);
    if (index < 0) return null;
    pets[index] = Object.assign({}, pets[index], updates, { id });
    if (!write(K.pets(s.email), pets)) return null;
    return pets[index];
  }

  // Appointments
  function getAllAppointments() { return read(K.appointments, []); }
  function getMyAppointments() {
    const s = getSession();
    return s ? getAllAppointments().filter(a => a.email === s.email) : [];
  }
  function addAppointment(appt) {
    const all = getAllAppointments();
    all.push(appt);
    write(K.appointments, all);
    return appt;
  }
  return {
    saveAccount, login, getSession, logout, initials,
    getPets, addPet, updatePet, getMyAppointments, addAppointment
  };
})();