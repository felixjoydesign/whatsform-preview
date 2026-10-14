// AI Editor animated demo
(function () {
  // The homepage emits the translated scenarios as JSON, because this file is
  // served straight from public/ and has no access to config/locales. The array
  // below is the English fallback for when that tag is absent.
  var scenarios = readScenarios() || [
    {
      prompt: 'I run a bakery and want to collect cake orders',
      fields: [
        { icon: 'fa-birthday-cake', label: 'Cake Flavour', chips: ['Chocolate', 'Vanilla', 'Red Velvet'] },
        { icon: 'fa-calendar', label: 'Delivery Date', placeholder: 'Select a date' }
      ]
    },
    {
      prompt: 'I need a reservation form for my restaurant',
      fields: [
        { icon: 'fa-users', label: 'Number of Guests', placeholder: 'How many people?' },
        { icon: 'fa-calendar', label: 'Reservation Date', placeholder: 'Select a date' }
      ]
    },
    {
      prompt: 'I own a salon and want to book appointments',
      fields: [
        { icon: 'fa-cut', label: 'Service', chips: ['Haircut', 'Colour', 'Styling'] },
        { icon: 'fa-clock', label: 'Time Slot', chips: ['Morning', 'Afternoon', 'Evening'] }
      ]
    }
  ];

  function readScenarios() {
    var tag = document.getElementById('ai-demo-data');
    if (!tag) return null;
    try {
      var parsed = JSON.parse(tag.textContent);
      return parsed && parsed.length ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  var phoneBody = document.getElementById('ai-phone-body');
  var promptText = document.getElementById('ai-demo-text');
  var generateBtn = document.getElementById('ai-demo-generate');
  var promptBox = document.getElementById('ai-demo-prompt');
  var footer = document.getElementById('ai-phone-footer');

  if (!phoneBody || !promptText || !generateBtn || !promptBox || !footer) return;

  var currentScenario = 0;
  var typingTimer = null;
  var isVisible = false;

  function typeText(text, callback) {
    var i = 0;
    promptText.innerHTML = '<span class="ai-cursor"></span>';
    typingTimer = setInterval(function () {
      if (i < text.length) {
        promptText.innerHTML = text.substring(0, i + 1) + '<span class="ai-cursor"></span>';
        i++;
      } else {
        clearInterval(typingTimer);
        typingTimer = null;
        promptText.innerHTML = text;
        if (callback) callback();
      }
    }, 40);
  }

  function renderShimmer() {
    promptBox.style.display = 'none';
    generateBtn.style.display = 'none';

    var container = document.createElement('div');
    container.id = 'ai-shimmer-container';
    for (var i = 0; i < 2; i++) {
      var block = document.createElement('div');
      block.className = 'ai-shimmer-block';
      block.style.marginBottom = '8px';
      block.innerHTML =
        '<div class="ai-shimmer-line" style="width:40%"></div>' +
        '<div class="ai-shimmer-line" style="width:100%;height:28px"></div>';
      container.appendChild(block);
    }
    phoneBody.appendChild(container);
  }

  function renderFields(fields) {
    var shimmer = document.getElementById('ai-shimmer-container');
    if (shimmer) shimmer.remove();

    fields.forEach(function (field, idx) {
      var el = document.createElement('div');
      el.className = 'ai-form-field field-delay-' + (idx + 1);
      var inner = '<div class="ai-field-label"><i class="fas ' + field.icon + '"></i>' + field.label + '</div>';
      if (field.chips) {
        inner += '<div class="ai-field-options">';
        field.chips.forEach(function (chip) {
          inner += '<span class="ai-field-chip">' + chip + '</span>';
        });
        inner += '</div>';
      } else {
        inner += '<div class="ai-field-input">' + field.placeholder + '</div>';
      }
      el.innerHTML = inner;
      phoneBody.appendChild(el);
    });

    footer.classList.add('visible');
  }

  function resetPhone() {
    phoneBody.innerHTML = '';
    promptBox.style.display = '';
    promptText.innerHTML = '';
    generateBtn.style.display = '';
    generateBtn.classList.remove('visible', 'clicked');
    footer.classList.remove('visible');
    phoneBody.appendChild(promptBox);
    phoneBody.appendChild(generateBtn);
  }

  function runScenario() {
    var scenario = scenarios[currentScenario];
    resetPhone();

    typeText(scenario.prompt, function () {
      setTimeout(function () {
        generateBtn.classList.add('visible');

        setTimeout(function () {
          generateBtn.classList.add('clicked');
          setTimeout(function () {
            generateBtn.classList.remove('clicked');
          }, 150);

          renderShimmer();

          setTimeout(function () {
            renderFields(scenario.fields);

            setTimeout(function () {
              currentScenario = (currentScenario + 1) % scenarios.length;
              runScenario();
            }, 3500);
          }, 1000);
        }, 600);
      }, 400);
    });
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting && !isVisible) {
        isVisible = true;
        setTimeout(runScenario, 500);
      }
    });
  }, { threshold: 0.3 });

  observer.observe(phoneBody);
})();
