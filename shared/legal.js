(() => {
  const policies = {
    terms: {
      title: 'Terms and Conditions',
      sections: [
        ['1. About this service', 'PetAppoint helps clients request veterinary appointments and manage pet profiles. By using this service, you agree to provide accurate contact, pet, and appointment information and to use the service lawfully and respectfully.'],
        ['2. Appointment requests', 'Submitting a booking request does not confirm an appointment. The clinic must review and confirm the requested time. The clinic may contact you if the requested time is unavailable or more information is needed.'],
        ['3. Services and pricing', 'Service descriptions, durations, and prices are estimates. The clinic may adjust the recommended treatment, duration, or final price after assessing your pet.'],
        ['4. Urgent care', 'PetAppoint is not an emergency response channel. For urgent or life-threatening concerns, contact the clinic directly or seek emergency veterinary care rather than waiting for an online response.'],
        ['5. Account responsibility', 'Keep your sign-in details secure and notify the clinic if you believe your account has been accessed without authorization.']
      ]
    },
    privacy: {
      title: 'Data Privacy',
      sections: [
        ['1. Information we use', 'PetAppoint uses account details, contact information, pet profiles, and appointment information to provide booking and clinic support services.'],
        ['2. Where information is stored', 'Appointment and client records are stored in Firebase. Pet profile details and pictures are saved in this browser’s local storage and may be visible to anyone with access to this browser.'],
        ['3. Access and use', 'Clinic administrators may access information needed to manage appointments and provide care. Do not upload pictures or enter information you do not want associated with your profile.'],
        ['4. Your choices and questions', 'You can remove a pet profile or sign out from the app; deleting a profile does not remove existing appointment history. Contact PetAppoint at PetAppoint@vet.ph with questions about your information.']
      ]
    },
    cancellation: {
      title: 'Cancellation Policy',
      sections: [
        ['1. Pending requests', 'Appointment requests remain pending until the clinic confirms them. A requested time is not guaranteed until it has been confirmed by the clinic.'],
        ['2. Changing or cancelling a visit', 'If you need to change or cancel a visit, contact the clinic as soon as possible and include your appointment reference when available.'],
        ['3. Reserved appointment times', 'Cancelled bookings release their reserved time when the clinic processes the cancellation. If a requested time is no longer available, the clinic will contact you to arrange another time.'],
        ['4. Urgent changes', 'For urgent changes or emergencies, call the clinic directly. This online service is not monitored as an emergency response channel.']
      ]
    }
  };

  const dialog = document.createElement('dialog');
  dialog.className = 'legal-dialog';
  dialog.setAttribute('aria-labelledby', 'legal-dialog-title');
  dialog.innerHTML = '<button class="legal-dialog-close" type="button" aria-label="Close">&times;</button>' +
    '<header class="legal-dialog-header"><p class="legal-dialog-kicker">PETAPPOINT VETERINARY CLINIC</p>' +
    '<h2 id="legal-dialog-title"></h2><p class="legal-dialog-date">Information for PetAppoint clients</p></header>' +
    '<div class="legal-dialog-content"></div><footer class="legal-dialog-footer">PetAppoint · Pet care, made easier</footer>';
  document.body.append(dialog);

  const title = dialog.querySelector('#legal-dialog-title');
  const content = dialog.querySelector('.legal-dialog-content');
  dialog.querySelector('.legal-dialog-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    if (event.target === dialog) dialog.close();
  });
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-legal]');
    if (!link || !policies[link.dataset.legal]) return;
    event.preventDefault();
    const policy = policies[link.dataset.legal];
    title.textContent = policy.title;
    content.replaceChildren(...policy.sections.map(([heading, paragraph]) => {
      const section = document.createElement('section');
      const sectionHeading = document.createElement('h3');
      const sectionText = document.createElement('p');
      sectionHeading.textContent = heading;
      sectionText.textContent = paragraph;
      section.append(sectionHeading, sectionText);
      return section;
    }));
    dialog.showModal();
  });
})();
