/* eslint-disable */

if (isMobileDevice()) {
  $('#signup-container-mobile').fadeIn('slow');
  $('#footer-signup-container-mobile').fadeIn('slow');
} else {
  $('#signup-container-desktop').fadeIn('slow');
  $('#footer-signup-container-desktop').fadeIn('slow');
}

// if (getCookie('wf-token')) {
//   $('#signup-container-desktop').hide();
//   $('#signup-container-mobile').show();
//   $('.login-button-text').text('Dashboard');
// }

function getIp(callback) {
  fetch('https://retrieve.whatsform.com/')
    .then((response) => response.json())
    .then((response) => callback(response.country.toLowerCase()))
    .catch(() => ({ country: 'us' }));
}

const signupPhoneField = document.querySelector('#phone');
let phoneInput;
if (signupPhoneField) {
  phoneInput = window.intlTelInput(signupPhoneField, {
    utilsScript:
      'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js',
    initialCountry: 'auto',
    separateDialCode: true,
    geoIpLookup: getIp,
  });
}

// Footer phone input
const footerPhoneInputField = document.querySelector('#footer-phone');
let footerPhoneInput;
if (footerPhoneInputField) {
  footerPhoneInput = window.intlTelInput(footerPhoneInputField, {
    utilsScript:
      'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js',
    initialCountry: 'auto',
    separateDialCode: true,
    geoIpLookup: getIp,
  });
}

const OTP_COUNTRIES = [
  '51',
  '52',
  '54',
  '55',
  '56',
  '57',
  '58',
  '593',
  '598',
  '595',
  '591',
  '971',
];

let intervalRef;
let activeForm = 'hero'; // Track which form is active

async function processSignup(event, lang, formType = 'hero') {
  event.preventDefault();
  event.stopImmediatePropagation();

  activeForm = formType;
  const isFooter = formType === 'footer';
  const prefix = isFooter ? 'footer-' : '';
  const currentPhoneInput = isFooter ? footerPhoneInput : phoneInput;
  const currentTokenInputs = isFooter ? footerTokenInputs : tokenInputs;

  if (window.gtag) window.gtag('event', 'signedup');
  if (window.plausible) window.plausible('Signup');
  if (window.posthog) window.posthog.capture('signup_initiated', { method: 'whatsapp', form_type: formType });
  if (window.visitors) window.visitors.track('signup_initiated', { method: 'whatsapp', form_type: formType });

  if (lang) createCookie('wf-language', lang, 30);

  $('.error-message').hide();

  const phoneNumber = currentPhoneInput.getNumber().substring(1);

  if (phoneNumber.slice(0, 2) === '90' || phoneNumber.slice(0, 3) === '599') {
    return $(`#${prefix}error-401006`).show();
  }

  if (!currentPhoneInput.isValidNumber()) {
    return $(`#${prefix}error-401005`).show();
  }

  if (isFooter) {
    $('#footer-signup-form > button.footer-action-button').hide();
    $('.footer-loading-button').show();
  } else {
    $('#signup-form > button.action-button').hide();
    $('.loading-button').show();
  }

  try {
    const response = await fetch(`${dashboardURL}/auth/whatsapp`, {
      method: 'POST',
      body: JSON.stringify({
        whatsappNumber: phoneNumber,
        language: lang,
      }),
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    if (response.ok) {
      if (isFooter) {
        $('.footer-signup-container .hide-on-token-screen').hide();
        $('.footer-token-input').show();
        footerTokenInputs[0].focus();
      } else {
        $('.hide-on-token-screen').hide();
        $('.signup-container-desktop-token-input').show();
        tokenInputs[0].focus();
      }
    } else {
      $(`#${prefix}error-401004`).show();
    }
  } catch (error) {
    $(`.${prefix}error-generic`).show();
  }
  
  if (isFooter) {
    $('.footer-loading-button').hide();
    $('#footer-signup-form > button.footer-action-button').show();
  } else {
    $('.loading-button').hide();
    $('#signup-form > button.action-button').show();
  }
}

let verificationFailedOnce = false;
async function verifyToken(formType = 'hero') {
  const isFooter = formType === 'footer';
  const prefix = isFooter ? 'footer-' : '';
  const currentPhoneInput = isFooter ? footerPhoneInput : phoneInput;
  const currentTokenInputs = isFooter ? footerTokenInputs : tokenInputs;

  $('.error-message').hide();

  const phoneNumber = currentPhoneInput.getNumber().substring(1);
  const token = getTokenValue(currentTokenInputs);

  const tokenRegex = /^[0-9]{6}$/;

  if (tokenRegex.test(token)) {
    disableTokenInputsFor(currentTokenInputs);
    $(`#${prefix}verification-token-input-loading`).show();

    try {
      const response = await fetch(`${dashboardURL}/auth/whatsapp/callback`, {
        method: 'POST',
        body: JSON.stringify({
          whatsappNumber: phoneNumber,
          token: token,
        }),
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        $(`#${prefix}verification-token-input-loading`).hide();
        const data = await response.json();

        createCookie('wf-token', data.token, 31);
        if (window.posthog) {
          window.posthog.identify(phoneNumber, { phone: phoneNumber });
          window.posthog.capture('signup_completed', { method: 'whatsapp', phone: phoneNumber });
        }
        if (window.visitors) {
          window.visitors.identify({ id: phoneNumber, phone: phoneNumber });
          window.visitors.track('signup_completed', { method: 'whatsapp' });
        }
        return (window.location = dashboardURL);
      } else {
        const errorObject = await response.json();
        setTokenInputEmptyFor(currentTokenInputs);
        $(`#${prefix}error-${errorObject.code}`).show();
      }
    } catch (e) {
      $(`.${prefix}error-generic`).show();
    }
  } else {
    $(`#${prefix}error-401003`).show();
  }
  enableTokenInputsFor(currentTokenInputs);
  verificationFailedOnce = true;
  $(`#${prefix}verification-token-input-loading`).hide();
}

function cancelTokenVerification(formType = 'hero') {
  const isFooter = formType === 'footer';
  const currentTokenInputs = isFooter ? footerTokenInputs : tokenInputs;

  $('.error-message').hide();
  
  if (isFooter) {
    $('.footer-token-input').hide();
    $('.footer-waiting-screen').hide();
    $('.footer-signup-container .hide-on-token-screen').fadeIn();
  } else {
    $('.signup-container-desktop-token-input').hide();
    $('.signup-container-desktop-waiting').hide();
    $('.hide-on-token-screen').fadeIn();
  }
  
  setTokenInputEmptyFor(currentTokenInputs);
  enableTokenInputsFor(currentTokenInputs);
  if (intervalRef) clearInterval(intervalRef);
}

// Handle token input

const tokenSection = document.querySelector('.otp-input-section');
const tokenInputs = tokenSection ? tokenSection.querySelectorAll('.otp-input-box') : [];

// Footer token inputs
const footerTokenSection = document.querySelector('.footer-otp-input-section');
const footerTokenInputs = footerTokenSection ? footerTokenSection.querySelectorAll('.footer-otp-input-box') : [];

// Setup token input handlers for hero form
function setupTokenInputHandlers(inputs, formType) {
  for (let i = 0; i < inputs.length; i++) {
    const ip = inputs[i];
    ip.addEventListener('input', (event) => {
      if (event.target.value && i < inputs.length - 1) {
        inputs[i + 1].focus();
      }
      const tokenFilled = isTokenInputFilledFor(inputs);
      if (tokenFilled) {
        handleTokenSubmission(formType, inputs);
      }
    });

    // Move focus to previous box if backspace is pressed on an empty ip
    ip.addEventListener('keydown', (event) => {
      if (
        !event.target.value &&
        (event.key === 'Backspace' || event.key === 'Delete')
      ) {
        event.preventDefault();
        inputs[i > 0 ? i - 1 : i].focus();
      }
    });

    ip.addEventListener('paste', (event) => {
      event.preventDefault();
      const tokenEmpty = isTokenInputEmptyFor(inputs);
      if (tokenEmpty) {
        const pastedValue = (event.clipboardData || window.clipboardData).getData(
          'text'
        );
        let j;
        for (j = 0; j < pastedValue.length && j < inputs.length; j++) {
          inputs[j].value = pastedValue.charAt(j);
        }
        if (j < inputs.length - 1) {
          inputs[j].focus();
        } else inputs[inputs.length - 1].focus();

        const tokenFilled = isTokenInputFilledFor(inputs);
        if (tokenFilled) {
          handleTokenSubmission(formType, inputs);
        }
      }
    });
  }
}

// Setup handlers for both forms
if (tokenInputs.length) setupTokenInputHandlers(tokenInputs, 'hero');
if (footerTokenInputs.length) setupTokenInputHandlers(footerTokenInputs, 'footer');

let verifyTokenTimer;
function handleTokenSubmission(formType, inputs) {
  clearTimeout(verifyTokenTimer);
  verifyTokenTimer = setTimeout(
    () => {
      if (isTokenInputFilledFor(inputs)) verifyToken(formType);
    },
    verificationFailedOnce ? 2000 : 1000
  );
}

function isTokenInputFilledFor(inputs) {
  let tokenFilled = true;
  inputs.forEach((ip) => {
    if (ip.value == '') tokenFilled = false;
  });
  return tokenFilled;
}

function isTokenInputEmptyFor(inputs) {
  let tokenEmpty = true;
  inputs.forEach((ip) => {
    if (ip.value) tokenEmpty = false;
  });
  return tokenEmpty;
}

function setTokenInputEmptyFor(inputs) {
  inputs.forEach((ip) => {
    ip.value = '';
  });
  if (inputs.length) inputs[0].focus();
}

function getTokenValue(inputs) {
  let value = '';
  inputs.forEach((ip) => {
    value += ip.value;
  });
  return value;
}

function disableTokenInputsFor(inputs) {
  inputs.forEach((ip) => {
    ip.disabled = true;
  });
}

function enableTokenInputsFor(inputs) {
  inputs.forEach((ip) => {
    ip.disabled = false;
  });
}

// Legacy functions for backward compatibility
function isTokenInputFilled() {
  return isTokenInputFilledFor(tokenInputs);
}

function isTokenInputEmpty() {
  return isTokenInputEmptyFor(tokenInputs);
}

function setTokenInputEmpty() {
  setTokenInputEmptyFor(tokenInputs);
}

function getToken() {
  return getTokenValue(tokenInputs);
}

function disableTokenInputs() {
  disableTokenInputsFor(tokenInputs);
}

function enableTokenInputs() {
  enableTokenInputsFor(tokenInputs);
}
function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(
    /[?&]+([^=&]+)=([^&]*)/gi,
    function (m, key, value) {
      vars[key] = value;
    }
  );
  return vars;
}

if (getUrlVars()['utm_source']) {
  if (getUrlVars()['utm_source'] === 'whatsform/broken') {
    $('.contactus').hide();
  } else {
    $('.contactus').attr(
      'href',
      'https://whatsform.com/help/contact?utm_source=' +
        getUrlVars()['utm_source']
    );
  }
}
