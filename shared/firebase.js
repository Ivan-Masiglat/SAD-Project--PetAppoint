import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  getAuth,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyA41ndoEeq-FCio7YuFBPhcfFn8_ZpBKyI",
  authDomain: "sad-003-final-project.firebaseapp.com",
  projectId: "sad-003-final-project",
  storageBucket: "sad-003-final-project.firebasestorage.app",
  messagingSenderId: "973644153240",
  appId: "1:973644153240:web:db1b83aa5b024fc453ebed",
  measurementId: "G-R5GK4N2NHD"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
const db = getFirestore(app);

export const DEFAULT_SERVICES = [
  { id: 'wellness', name: 'Wellness Check-up', minutes: 30, description: 'Full physical exam with advice on diet, weight and routine care.', price: 500 },
  { id: 'vaccination', name: 'Vaccinations', minutes: 20, description: "Core and optional vaccines for your pet's age, species and lifestyle.", price: 500 },
  { id: 'dental', name: 'Dental Care', minutes: 45, description: 'Teeth cleaning and oral checks to prevent gum disease.', price: 1500 },
  { id: 'grooming', name: 'Grooming & Hygiene', minutes: 60, description: 'Bath, trim, nail clipping and ear cleaning by gentle, trained staff.', price: 500 },
  { id: 'procedures', name: 'Minor Procedures', minutes: 60, description: 'Spay/neuter consultations and minor procedures. Pre-op screening required.', price: 5000 },
  { id: 'senior', name: 'Senior & Special Care', minutes: 40, description: 'Gentle, accessible care plans for older pets and pets with special needs.', price: 700 },
  { id: 'emergency', name: 'Emergency Care', minutes: 30, description: 'Urgent assessment for pets that need prompt veterinary attention.', price: 1000 }
];

export async function signInAdmin(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  if ((credential.user.email || '').toLowerCase() !== 'admin@gmail.com') {
    await signOut(auth);
    throw new Error('This Firebase account is not the clinic administrator.');
  }
  return credential.user;
}

export async function registerClient({ firstName, lastName, email, phone }, password) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const user = credential.user;
  try {
    await setDoc(doc(db, 'clients', user.uid), {
      firstName,
      lastName,
      email: (user.email || email).toLowerCase(),
      phone,
      createdAt: serverTimestamp()
    });
  } catch (error) {
    try {
      await deleteUser(user);
    } catch (rollbackError) {
      console.error('Could not roll back Firebase Authentication after profile creation failed.', rollbackError);
    }
    throw error;
  }
  return user;
}

export async function signInClient(email, password) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  if ((credential.user.email || '').toLowerCase() === 'admin@gmail.com') {
    await signOut(auth);
    throw new Error('Use the administrator sign-in flow.');
  }
  try {
    const profile = await getDoc(doc(db, 'clients', credential.user.uid));
    if (!profile.exists()) throw new Error('The client profile is missing from Firestore.');
    return { user: credential.user, profile: profile.data() };
  } catch (error) {
    await signOut(auth);
    throw error;
  }
}

export function signOutUser() {
  return signOut(auth);
}

export async function getServices() {
  const snapshot = await getDocs(collection(db, 'services'));
  return snapshot.docs.map(document => {
    const data = document.data();
    if (typeof data.name !== 'string' || typeof data.description !== 'string' ||
        !Number.isInteger(data.minutes)) {
      throw new Error('A service record in Firestore has invalid fields.');
    }
    return {
      id: document.id,
      name: data.name,
      description: data.description,
      minutes: data.minutes,
      price: Number.isFinite(data.price) ? data.price : null
    };
  });
}

export async function getServicePriceOverrides() {
  const snapshot = await getDocs(collection(db, 'servicePrices'));
  return Object.fromEntries(snapshot.docs.map(document => {
    const price = document.data().price;
    if (!Number.isFinite(price) || price < 0) {
      throw new Error('A service price record in Firestore has an invalid price.');
    }
    return [document.id, price];
  }));
}

export async function setServicePrice(id, price, custom = false) {
  await auth.authStateReady();
  if ((auth.currentUser?.email || '').toLowerCase() !== 'admin@gmail.com') {
    throw new Error('Sign in with the administrator account to update service prices.');
  }
  if (typeof id !== 'string' || !id || !Number.isFinite(price) || price < 0 || price > 1000000) {
    throw new Error('Enter a valid service and price from 0 to 1,000,000.');
  }
  if (custom) {
    await updateDoc(doc(db, 'services', id), { price });
    return;
  }
  await setDoc(doc(db, 'servicePrices', id), {
    price,
    updatedAt: serverTimestamp()
  });
}

export async function getClientProfiles() {
  await auth.authStateReady();
  if ((auth.currentUser?.email || '').toLowerCase() !== 'admin@gmail.com') {
    throw new Error('Sign in with the administrator account to view client profiles.');
  }
  const snapshot = await getDocs(collection(db, 'clients'));
  return snapshot.docs.map(document => ({ id: document.id, ...document.data() }));
}

function appointmentFromDocument(document) {
  return { id: document.id, ...document.data() };
}

export async function getAdminAppointments() {
  await auth.authStateReady();
  if ((auth.currentUser?.email || '').toLowerCase() !== 'admin@gmail.com') {
    throw new Error('Sign in with the administrator account to view appointments.');
  }
  const snapshot = await getDocs(collection(db, 'appointments'));
  const appointments = snapshot.docs.map(appointmentFromDocument);
  await syncAppointmentSlotReservations(appointments);
  await removeStaleAppointmentSlotReservations(appointments);
  return appointments;
}

export async function subscribeAdminAppointments(onUpdate, onError) {
  await auth.authStateReady();
  if ((auth.currentUser?.email || '').toLowerCase() !== 'admin@gmail.com') {
    throw new Error('Sign in with the administrator account to view appointments.');
  }
  return onSnapshot(collection(db, 'appointments'), snapshot => {
    onUpdate(snapshot.docs.map(appointmentFromDocument));
  }, onError);
}

export async function getClientAppointments() {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || (user.email || '').toLowerCase() === 'admin@gmail.com') {
    throw new Error('Sign in with a client account to view appointments.');
  }
  const snapshot = await getDocs(query(
    collection(db, 'appointments'),
    where('ownerUid', '==', user.uid)
  ));
  return snapshot.docs.map(appointmentFromDocument);
}

export async function updateClientPetAppointments(petId, { name, species }) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || (user.email || '').toLowerCase() === 'admin@gmail.com') {
    throw new Error('Sign in with a client account to update pet appointment details.');
  }
  if (typeof petId !== 'string' || !petId ||
      typeof name !== 'string' || !name.trim() || name.trim().length > 80 ||
      typeof species !== 'string' || !species.trim() || species.trim().length > 80) {
    throw new Error('Enter a valid pet name and species.');
  }

  const snapshot = await getDocs(query(
    collection(db, 'appointments'),
    where('ownerUid', '==', user.uid)
  ));
  const petAppointments = snapshot.docs.filter(document => document.data().petId === petId);
  const appointmentsToUpdate = petAppointments.filter(document =>
    document.data().petName !== name.trim() || document.data().petSpecies !== species.trim()
  );
  for (let offset = 0; offset < appointmentsToUpdate.length; offset += 450) {
    const batch = writeBatch(db);
    appointmentsToUpdate.slice(offset, offset + 450).forEach(document => {
      batch.update(document.ref, {
        petName: name.trim(),
        petSpecies: species.trim()
      });
    });
    await batch.commit();
  }
  return {
    linkedAppointments: petAppointments.length,
    updatedAppointments: appointmentsToUpdate.length
  };
}

function appointmentSlotId(date, time) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      typeof time !== 'string' || !/^\d{1,2}:\d{2} (AM|PM)$/.test(time)) {
    throw new Error('Choose a valid appointment date and time.');
  }
  return date.replace(/-/g, '') + '_' + time.replace(/[^0-9APM]/g, '');
}

async function syncAppointmentSlotReservations(appointments) {
  for (const appointment of appointments) {
    if (!['pending', 'confirmed'].includes(appointment.status)) continue;
    let slotId;
    try {
      slotId = appointmentSlotId(appointment.date, appointment.time);
    } catch (error) {
      console.error('Could not reserve an existing appointment with an invalid date or time.', appointment.id, error);
      continue;
    }

    const appointmentRef = doc(db, 'appointments', appointment.id);
    const slotRef = doc(db, 'appointmentSlots', slotId);
    const availabilityRef = doc(db, 'appointmentAvailability', slotId);
    const result = await runTransaction(db, async transaction => {
      const [appointmentSnapshot, slotSnapshot, availabilitySnapshot] = await Promise.all([
        transaction.get(appointmentRef),
        transaction.get(slotRef),
        transaction.get(availabilityRef)
      ]);
      if (!appointmentSnapshot.exists()) return 'missing';
      const current = appointmentSnapshot.data();
      if (!['pending', 'confirmed'].includes(current.status)) return 'inactive';
      if (current.date !== appointment.date || current.time !== appointment.time) return 'changed';
      if (slotSnapshot.exists() && slotSnapshot.data().appointmentId !== appointment.id) return 'occupied';
      if (!slotSnapshot.exists()) {
        transaction.set(slotRef, {
          appointmentId: appointment.id,
          date: current.date,
          time: current.time
        });
      }
      if (!availabilitySnapshot.exists()) {
        transaction.set(availabilityRef, { date: current.date, time: current.time });
      }
      if (current.slotId !== slotId) transaction.update(appointmentRef, { slotId });
      return 'reserved';
    });
    if (result === 'occupied') {
      console.error('An existing appointment shares a time already reserved by another appointment.', appointment.id);
    } else if (result === 'reserved') {
      appointment.slotId = slotId;
    }
  }
}

async function removeStaleAppointmentSlotReservations(appointments) {
  const activeAppointments = new Map(
    appointments
      .filter(appointment => ['pending', 'confirmed'].includes(appointment.status))
      .map(appointment => [appointment.id, appointment])
  );
  const snapshot = await getDocs(collection(db, 'appointmentSlots'));
  for (const slot of snapshot.docs) {
    const reservation = slot.data();
    const appointment = activeAppointments.get(reservation.appointmentId);
    let expectedSlotId = '';
    if (appointment) {
      try {
        expectedSlotId = appointmentSlotId(appointment.date, appointment.time);
      } catch (error) {
        console.error('Could not validate a calendar reservation for an invalid appointment date or time.', appointment.id, error);
      }
    }
    if (appointment && slot.id === expectedSlotId &&
        reservation.date === appointment.date && reservation.time === appointment.time) continue;

    await runTransaction(db, async transaction => {
      const [currentSlot, currentAppointment] = await Promise.all([
        transaction.get(slot.ref),
        reservation.appointmentId
          ? transaction.get(doc(db, 'appointments', reservation.appointmentId))
          : Promise.resolve(null)
      ]);
      if (!currentSlot.exists()) return;
      if (currentAppointment?.exists()) {
        const current = currentAppointment.data();
        if (['pending', 'confirmed'].includes(current.status) &&
            current.slotId === slot.id &&
            current.date === currentSlot.data().date &&
            current.time === currentSlot.data().time) return;
      }
      transaction.delete(slot.ref);
      transaction.delete(doc(db, 'appointmentAvailability', slot.id));
    });
  }

  const availabilitySnapshot = await getDocs(collection(db, 'appointmentAvailability'));
  for (const availability of availabilitySnapshot.docs) {
    const slotRef = doc(db, 'appointmentSlots', availability.id);
    await runTransaction(db, async transaction => {
      const [currentAvailability, currentSlot] = await Promise.all([
        transaction.get(availability.ref),
        transaction.get(slotRef)
      ]);
      if (!currentAvailability.exists() || currentSlot.exists()) return;
      transaction.delete(availability.ref);
    });
  }
}

export async function getBookedAppointmentSlots(fromDate, toDate) {
  const snapshot = await getDocs(query(
    collection(db, 'appointmentAvailability'),
    where('date', '>=', fromDate),
    where('date', '<=', toDate)
  ));
  return snapshot.docs.map(document => document.data());
}

export async function createAppointment(appointment) {
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user || (user.email || '').toLowerCase() === 'admin@gmail.com') {
    throw new Error('Sign in with a client account before booking an appointment.');
  }
  const { id, createdAt, ...data } = appointment;
  const slotId = appointmentSlotId(data.date, data.time);
  const appointmentRef = doc(collection(db, 'appointments'));
  const slotRef = doc(db, 'appointmentSlots', slotId);
  const availabilityRef = doc(db, 'appointmentAvailability', slotId);
  await runTransaction(db, async transaction => {
    const existingSlot = await transaction.get(slotRef);
    if (existingSlot.exists()) {
      throw new Error('That appointment time was just taken. Choose another available time.');
    }
    transaction.set(slotRef, {
      appointmentId: appointmentRef.id,
      date: data.date,
      time: data.time
    });
    transaction.set(availabilityRef, {
      date: data.date,
      time: data.time
    });
    transaction.set(appointmentRef, {
      ...data,
      slotId,
      ownerUid: user.uid,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  });
  return { ...data, id: appointmentRef.id, slotId, ownerUid: user.uid, status: 'pending' };
}

export async function updateAppointment(id, changes) {
  await auth.authStateReady();
  if ((auth.currentUser?.email || '').toLowerCase() !== 'admin@gmail.com') {
    throw new Error('Sign in with the administrator account to update appointments.');
  }
  const updates = { ...changes };
  if (Object.prototype.hasOwnProperty.call(updates, 'previousStatus') &&
      updates.previousStatus === undefined) {
    updates.previousStatus = deleteField();
  }
  const appointmentRef = doc(db, 'appointments', id);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(appointmentRef);
    if (!snapshot.exists()) throw new Error('Appointment not found.');
    const current = snapshot.data();
    const next = { ...current, ...changes };
    const releasesSlot = ['cancelled', 'completed'].includes(next.status);
    const reopensAppointment = current.status === 'cancelled' &&
      ['pending', 'confirmed'].includes(next.status);
    if (reopensAppointment) {
      const newSlotId = appointmentSlotId(next.date, next.time);
      const newSlotRef = doc(db, 'appointmentSlots', newSlotId);
      const newAvailabilityRef = doc(db, 'appointmentAvailability', newSlotId);
      const slotSnapshot = await transaction.get(newSlotRef);
      if (slotSnapshot.exists() && slotSnapshot.data().appointmentId !== id) {
        throw new Error('That appointment time was just taken. Choose another time.');
      }
      transaction.set(newSlotRef, {
        appointmentId: id,
        date: next.date,
        time: next.time
      });
      transaction.set(newAvailabilityRef, {
        date: next.date,
        time: next.time
      });
      updates.slotId = newSlotId;
    } else if (releasesSlot && current.slotId) {
      transaction.delete(doc(db, 'appointmentSlots', current.slotId));
      transaction.delete(doc(db, 'appointmentAvailability', current.slotId));
    }
    transaction.update(appointmentRef, updates);
  });
}

export async function addService({ name, minutes, description, price }) {
  if (auth.currentUser?.email?.toLowerCase() !== 'admin@gmail.com') {
    throw new Error('Sign in with the administrator account before adding services.');
  }
  if (!Number.isFinite(price) || price < 0 || price > 1000000) {
    throw new Error('Enter a valid service price from 0 to 1,000,000.');
  }
  return addDoc(collection(db, 'services'), {
    name,
    minutes,
    description,
    price,
    createdAt: serverTimestamp()
  });
}
