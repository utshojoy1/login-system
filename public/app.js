'use strict';

(() => {
  for (const toggle of document.querySelectorAll('[data-password-toggle]')) {
    toggle.addEventListener('click', () => {
      const wrap = toggle.closest('.input-wrap');
      const input = wrap ? wrap.querySelector('input') : null;
      if (!input) {
        return;
      }

      const shouldShow = input.type === 'password';
      input.type = shouldShow ? 'text' : 'password';
      toggle.setAttribute('aria-pressed', String(shouldShow));
      toggle.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
      toggle.setAttribute('title', shouldShow ? 'Hide password' : 'Show password');
      input.focus({ preventScroll: true });
    });
  }

  const signupForm = document.querySelector('[data-signup-form]');
  if (signupForm) {
    const password = signupForm.querySelector('#password');
    const confirmPassword = signupForm.querySelector('#confirmPassword');

    if (password && confirmPassword) {
      const validateConfirmation = () => {
        const matches = !confirmPassword.value || password.value === confirmPassword.value;
        confirmPassword.setCustomValidity(matches ? '' : 'Passwords do not match.');
      };

      password.addEventListener('input', validateConfirmation);
      confirmPassword.addEventListener('input', validateConfirmation);
    }
  }
})();
