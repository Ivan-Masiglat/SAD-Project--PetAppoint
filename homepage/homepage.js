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

  // Book Appointment + booking flow
  document.getElementById('book-btn').addEventListener('click', () => {
    window.location.href = '../booking/booking.html';
  });

  document.getElementById('book-btn').addEventListener('click', function () {
  window.location.href = '../booking/booking.html';
});
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