(function() {
	var STORAGE_KEY = 'wf-templates';
	var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var locale = window.__templateLocale || {};

	function generateId() {
		return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
	}

	function getTemplates() {
		try {
			var data = localStorage.getItem(STORAGE_KEY);
			return data ? JSON.parse(data) : [];
		} catch (e) { return []; }
	}

	function saveTemplates(templates) {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
	}

	function seedDefaults() {
		if (localStorage.getItem(STORAGE_KEY)) return;
		var defaults = [
			{
				id: 'default-order-confirm',
				name: 'Order Confirmation',
				body: 'Hi {Customer Name}, your order #{Order ID} has been confirmed!\n\nOrder Date: {Date}\nItems: {Items}\nTotal: {Total Amount}\n\nWe will notify you when your order is shipped. Thank you for shopping with us!',
				fields: [
					{ name: 'Customer Name', type: 'text' },
					{ name: 'Order ID', type: 'text' },
					{ name: 'Date', type: 'date' },
					{ name: 'Items', type: 'text', multi: true },
					{ name: 'Total Amount', type: 'text' }
				],
				createdAt: new Date().toISOString().split('T')[0]
			},
			{
				id: 'default-daily-sales',
				name: 'Daily Sales Report',
				body: 'Sales Report - {Date} ({Day})\nTime: {Time}\n\nTotal Sales: {Total Sales}\nOrders: {Number of Orders}\nTop Product: {Top Product}\n\nNotes: {Notes}',
				fields: [
					{ name: 'Date', type: 'date' },
					{ name: 'Day', type: 'day' },
					{ name: 'Time', type: 'time' },
					{ name: 'Total Sales', type: 'text' },
					{ name: 'Number of Orders', type: 'text' },
					{ name: 'Top Product', type: 'text' },
					{ name: 'Notes', type: 'text' }
				],
				createdAt: new Date().toISOString().split('T')[0]
			}
		];
		saveTemplates(defaults);
	}

	function migrateDefaults() {
		var templates = getTemplates();
		if (!templates.length) return;
		var changed = false;
		templates.forEach(function(t) {
			if (t.id === 'default-order-confirm' && t.fields) {
				t.fields.forEach(function(f) {
					if (f.name === 'Items' && !f.multi) {
						f.multi = true;
						changed = true;
					}
				});
			}
		});
		if (changed) saveTemplates(templates);
	}

	function parseFields(body, existingFields) {
		var fields = [];
		var regex = /\{([^}]+)\}/g;
		var match;
		var seen = {};
		var existingMap = {};
		if (existingFields) {
			existingFields.forEach(function(f) { existingMap[f.name] = f; });
		}
		while ((match = regex.exec(body)) !== null) {
			var name = match[1];
			if (!seen[name]) {
				seen[name] = true;
				var type = 'text';
				if (name === 'Date') type = 'date';
				else if (name === 'Time') type = 'time';
				else if (name === 'Day') type = 'day';
				var field = { name: name, type: type };
				if (existingMap[name] && existingMap[name].multi) {
					field.multi = true;
				}
				fields.push(field);
			}
		}
		return fields;
	}

	function getAutoFillValue(type) {
		var now = new Date();
		if (type === 'date') {
			return now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
		}
		if (type === 'time') {
			var h = now.getHours();
			var m = now.getMinutes();
			var ampm = h >= 12 ? 'PM' : 'AM';
			h = h % 12 || 12;
			return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm;
		}
		if (type === 'day') {
			return DAYS[now.getDay()];
		}
		return '';
	}

	function composeMessage(body, fields, fieldValues) {
		var msg = body;
		fields.forEach(function(field) {
			var value = fieldValues[field.name] || '';
			var escaped = field.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			msg = msg.replace(new RegExp('\\{' + escaped + '\\}', 'g'), value);
		});
		return msg;
	}

	function copyToClipboard(text) {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(text).catch(function() { fallbackCopy(text); });
		} else {
			fallbackCopy(text);
		}
	}

	function fallbackCopy(text) {
		var textarea = document.createElement('textarea');
		textarea.value = text;
		document.body.appendChild(textarea);
		textarea.select();
		document.execCommand('copy');
		document.body.removeChild(textarea);
	}

	function insertAtCursor(textarea, text) {
		var start = textarea.selectionStart;
		var end = textarea.selectionEnd;
		var before = textarea.value.substring(0, start);
		var after = textarea.value.substring(end);
		textarea.value = before + text + after;
		textarea.selectionStart = textarea.selectionEnd = start + text.length;
		textarea.focus();
	}

	function escapeHtml(str) {
		return $('<span>').text(str).html();
	}

	function renderModalPreview(body) {
		var $box = $('#modal-preview-box');
		if (!body.trim()) {
			$box.html('<span class="template-modal-preview-empty">' + (locale.previewPlaceholder || 'Start typing to see preview...') + '</span>');
			return;
		}
		var escaped = escapeHtml(body);
		escaped = escaped.replace(/\{Date\}/g, '<span class="preview-var-auto">' + escapeHtml(getAutoFillValue('date')) + '</span>');
		escaped = escaped.replace(/\{Time\}/g, '<span class="preview-var-auto">' + escapeHtml(getAutoFillValue('time')) + '</span>');
		escaped = escaped.replace(/\{Day\}/g, '<span class="preview-var-auto">' + escapeHtml(getAutoFillValue('day')) + '</span>');
		escaped = escaped.replace(/\{([^}]+)\}/g, '<span class="preview-var-custom">$1</span>');
		escaped = escaped.replace(/\n/g, '<br>');
		$box.html('<div class="preview-bubble">' + escaped + '</div>');
	}

	// Phone input
	var phoneInputField = document.querySelector('#phone');
	var phoneInput = window.intlTelInput(phoneInputField, {
		utilsScript: 'https://cdnjs.cloudflare.com/ajax/libs/intl-tel-input/17.0.8/js/utils.js',
		initialCountry: 'auto',
		separateDialCode: true,
		geoIpLookup: getIp,
	});

	$(document).ready(function() {
		var $emptyCreate = $('#template-empty-create');
		var $mainPanel = $('#template-main-panel');
		var $customSelect = $('#template-select');
		var $selectTrigger = $customSelect.find('.template-custom-select-trigger span');
		var $selectOptions = $('#template-select-options');
		var $fillLayout = $('#template-fill-layout');
		var $fields = $('#template-fields');
		var $previewBox = $('#template-preview-box');
		var $modal = $('#template-modal');
		var currentTemplate = null;
		var selectedValue = '';
		var copyLabel = locale.copy || 'Copy';

		// --- Custom dropdown ---
		$customSelect.find('.template-custom-select-trigger').click(function(e) {
			e.stopPropagation();
			$customSelect.toggleClass('open');
		});

		$(document).click(function() {
			$customSelect.removeClass('open');
		});

		function selectTemplate(id) {
			selectedValue = id;
			$selectOptions.find('.template-select-option').removeClass('selected');
			if (id) {
				$selectOptions.find('[data-value="' + id + '"]').addClass('selected');
				var name = $selectOptions.find('[data-value="' + id + '"]').text();
				$selectTrigger.text(name);
			} else {
				$selectTrigger.text(locale.selectPlaceholder || '-- Select a template --');
			}
			$customSelect.removeClass('open');
			onTemplateChange(id);
		}

		$selectOptions.on('click', '.template-select-option', function(e) {
			e.stopPropagation();
			var val = $(this).data('value');
			if (val === '__create__') {
				$customSelect.removeClass('open');
				$modal.show();
				showEditorView();
				return;
			}
			selectTemplate(val);
		});

		function showEmptyState() {
			$emptyCreate.show();
			$mainPanel.hide();
		}

		function showMainPanel(autoSelectId) {
			$emptyCreate.hide();
			$mainPanel.show();
			refreshTemplateSelect();
			if (autoSelectId) {
				selectTemplate(autoSelectId);
			}
		}

		var editingId = null;
		var $listView = $('#modal-list-view');
		var $editorView = $('#modal-editor-view');
		var $modalList = $('#modal-template-list');

		// --- Modal ---
		function openModal() {
			showListView();
			$modal.show();
		}

		function closeModal() {
			$modal.hide();
			editingId = null;
		}

		var $backBtn = $('#modal-back-btn');

		function showListView() {
			$listView.show();
			$editorView.hide();
			$backBtn.hide();
			$('#modal-title span').text(locale.manageTitle || 'Manage Templates');
			renderModalList();
		}

		function showEditorView(template) {
			editingId = template ? template.id : null;
			$('#modal-template-name').val(template ? template.name : '');
			$('#modal-template-body').val(template ? template.body : '');
			$('#modal-custom-row').hide();
			modalMultiFields = {};
			if (template && template.fields) {
				template.fields.forEach(function(f) {
					if (f.multi) modalMultiFields[f.name] = true;
				});
			}
			renderModalPreview(template ? template.body : '');
			$('#modal-title span').text(template ? (locale.editTitle || 'Edit Template') : (locale.createTitle || 'Create Template'));
			$listView.hide();
			$editorView.show();
			$backBtn.show();
		}

		function renderModalList() {
			var templates = getTemplates();
			if (templates.length === 0) {
				$modalList.html('<p class="template-modal-empty">No templates yet. Create your first one!</p>');
				return;
			}
			var html = '';
			templates.forEach(function(t) {
				var fieldCount = t.fields ? t.fields.length : 0;
				html += '<div class="template-saved-item">' +
					'<div class="template-saved-info">' +
					'<span class="template-saved-name">' + escapeHtml(t.name) + '</span>' +
					'<span class="template-saved-meta">' + fieldCount + ' field' + (fieldCount !== 1 ? 's' : '') + '</span>' +
					'</div>' +
					'<div class="template-saved-actions">' +
					'<button class="template-edit-btn" data-id="' + t.id + '"><i class="fas fa-edit"></i></button>' +
					'<button class="template-delete-btn" data-id="' + t.id + '"><i class="fas fa-trash-alt"></i></button>' +
					'</div>' +
					'</div>';
			});
			$modalList.html(html);
		}

		$('#template-open-modal-btn').click(openModal);
		$('#template-empty-create-btn').click(function() {
			$modal.show();
			showEditorView();
		});
		$('#template-modal-close').click(closeModal);
		$modal.click(function(e) {
			if (e.target === this) closeModal();
		});

		$('#modal-create-new-btn').click(function() { showEditorView(); });
		$('#modal-back-btn').click(function() { showListView(); });

		$modalList.on('click', '.template-edit-btn', function() {
			var id = $(this).data('id');
			var template = getTemplates().find(function(t) { return t.id === id; });
			if (template) showEditorView(template);
		});

		$modalList.on('click', '.template-delete-btn', function() {
			var id = $(this).data('id');
			var templates = getTemplates().filter(function(t) { return t.id !== id; });
			saveTemplates(templates);
			renderModalList();
			refreshTemplateSelect();
			if (currentTemplate && currentTemplate.id === id) {
				selectTemplate('');
			}
			if (templates.length === 0) {
				closeModal();
				showEmptyState();
			}
		});

		// Modal insert buttons
		$('.modal-insert-btn').click(function() {
			var type = $(this).data('type');
			var textarea = document.getElementById('modal-template-body');
			if (type === 'custom') {
				$('#modal-custom-row').show();
				$('#modal-custom-name').val('').focus();
			} else {
				var label = type.charAt(0).toUpperCase() + type.slice(1);
				insertAtCursor(textarea, '{' + label + '}');
				renderModalPreview(textarea.value);
			}
		});

		var modalMultiFields = {};

		$('#modal-custom-add').click(function() {
			var fieldName = $('#modal-custom-name').val().trim();
			if (fieldName) {
				var textarea = document.getElementById('modal-template-body');
				insertAtCursor(textarea, '{' + fieldName + '}');
				if ($('#modal-custom-multi').is(':checked')) {
					modalMultiFields[fieldName] = true;
				}
				renderModalPreview(textarea.value);
			}
			$('#modal-custom-row').hide();
			$('#modal-custom-name').val('');
			$('#modal-custom-multi').prop('checked', false);
		});

		$('#modal-custom-cancel').click(function() {
			$('#modal-custom-row').hide();
			$('#modal-custom-name').val('');
			$('#modal-custom-multi').prop('checked', false);
		});

		$('#modal-custom-name').keypress(function(e) {
			if (e.which === 13) {
				$('#modal-custom-add').click();
			}
		});

		// Live preview on textarea input
		$('#modal-template-body').on('input', function() {
			renderModalPreview($(this).val());
		});

		// Save from modal
		$('#modal-template-save').click(function() {
			var name = $('#modal-template-name').val().trim();
			var body = $('#modal-template-body').val().trim();
			if (!name || !body) return;

			var existingFields = [];
			if (editingId) {
				var existing = getTemplates().find(function(t) { return t.id === editingId; });
				if (existing) existingFields = existing.fields || [];
			}
			var fields = parseFields(body, existingFields);
			fields.forEach(function(f) {
				if (modalMultiFields[f.name]) f.multi = true;
			});
			var templates = getTemplates();
			var selectId;

			if (editingId) {
				templates = templates.map(function(t) {
					if (t.id === editingId) {
						return { id: t.id, name: name, body: body, fields: fields, createdAt: t.createdAt };
					}
					return t;
				});
				selectId = editingId;
			} else {
				selectId = generateId();
				templates.push({
					id: selectId,
					name: name,
					body: body,
					fields: fields,
					createdAt: new Date().toISOString().split('T')[0]
				});
			}
			saveTemplates(templates);
			closeModal();
			showMainPanel(selectId);
		});

		// --- Template select ---
		function refreshTemplateSelect() {
			var templates = getTemplates();
			var html = '';
			templates.forEach(function(t) {
				html += '<div class="template-select-option' + (selectedValue === t.id ? ' selected' : '') + '" data-value="' + t.id + '">' + escapeHtml(t.name) + '</div>';
			});
			html += '<div class="template-select-option create-option" data-value="__create__">+ Create New Template</div>';
			$selectOptions.html(html);
		}

		function onTemplateChange(id) {
			if (!id) {
				currentTemplate = null;
				$fillLayout.hide();
				$fields.empty();
				return;
			}

			var templates = getTemplates();
			currentTemplate = templates.find(function(t) { return t.id === id; });
			if (!currentTemplate) return;

			renderFields(currentTemplate);
			$fillLayout.show();
			updatePreview();
		}

		function renderFields(template) {
			var html = '';
			template.fields.forEach(function(field) {
				var autoValue = getAutoFillValue(field.type);
				var isAuto = field.type === 'date' || field.type === 'time' || field.type === 'day';
				var icon = '';
				if (field.type === 'date') icon = '<i class="fas fa-calendar-alt"></i>';
				else if (field.type === 'time') icon = '<i class="fas fa-clock"></i>';
				else if (field.type === 'day') icon = '<i class="fas fa-calendar-day"></i>';
				else icon = '<i class="fas fa-pen"></i>';

				if (field.multi) {
					html += '<div class="template-field-row template-multi-group" data-field="' + escapeHtml(field.name) + '">' +
						'<label class="template-field-label">' + icon + ' ' + escapeHtml(field.name) +
						' <span class="template-multi-badge">Multiple</span>' +
						'</label>' +
						'<div class="template-multi-entries">' +
						'<div class="template-multi-entry">' +
						'<input type="text" class="template-field-input template-multi-input" placeholder="Enter ' + escapeHtml(field.name) + ' #1">' +
						'</div>' +
						'</div>' +
						'<button type="button" class="template-multi-add-btn" data-field="' + escapeHtml(field.name) + '">' +
						'<i class="fas fa-plus"></i> Add ' + escapeHtml(field.name) +
						'</button>' +
						'</div>';
				} else {
					html += '<div class="template-field-row">' +
						'<label class="template-field-label">' + icon + ' ' + escapeHtml(field.name) +
						(isAuto ? ' <span class="template-auto-badge">Auto</span>' : '') +
						'</label>' +
						'<input type="text" class="template-field-input" data-field="' + escapeHtml(field.name) + '" value="' + escapeHtml(autoValue) + '" placeholder="Enter ' + escapeHtml(field.name) + '">' +
						'</div>';
				}
			});
			$fields.html(html);
		}

		function updatePreview() {
			if (!currentTemplate) return;
			var fieldValues = {};
			$fields.find('.template-field-input:not(.template-multi-input)').each(function() {
				fieldValues[$(this).data('field')] = $(this).val();
			});
			$fields.find('.template-multi-group').each(function() {
				var fieldName = $(this).data('field');
				var values = [];
				$(this).find('.template-multi-input').each(function() {
					var v = $(this).val().trim();
					if (v) values.push(v);
				});
				if (values.length === 1) {
					fieldValues[fieldName] = values[0];
				} else if (values.length > 1) {
					fieldValues[fieldName] = values.map(function(v, i) { return (i + 1) + '. ' + v; }).join('\n');
				} else {
					fieldValues[fieldName] = '';
				}
			});
			var msg = composeMessage(currentTemplate.body, currentTemplate.fields, fieldValues);
			$previewBox.text(msg);
			updateSendLink(msg);
		}

		function updateSendLink(msg) {
			var phoneNumber = phoneInput.getNumber().replace('+', '');
			var link = 'https://wa.me/' + phoneNumber + '?text=' + encodeURIComponent(msg);
			$('#template-send-btn').attr('href', link);
		}

		$fields.on('input', '.template-field-input', updatePreview);

		$fields.on('click', '.template-multi-add-btn', function() {
			var $group = $(this).closest('.template-multi-group');
			var fieldName = $group.data('field');
			var count = $group.find('.template-multi-entry').length + 1;
			var entry = '<div class="template-multi-entry">' +
				'<input type="text" class="template-field-input template-multi-input" placeholder="Enter ' + escapeHtml(fieldName) + ' #' + count + '">' +
				'<button type="button" class="template-multi-remove-btn"><i class="fas fa-times"></i></button>' +
				'</div>';
			$group.find('.template-multi-entries').append(entry);
			$group.find('.template-multi-input').last().focus();
		});

		$fields.on('click', '.template-multi-remove-btn', function() {
			var $group = $(this).closest('.template-multi-group');
			$(this).closest('.template-multi-entry').remove();
			// Re-number placeholders
			$group.find('.template-multi-entry').each(function(i) {
				$(this).find('.template-multi-input').attr('placeholder', 'Enter ' + $group.data('field') + ' #' + (i + 1));
			});
			updatePreview();
		});
		$('#phone').on('input countrychange', function() {
			if (currentTemplate) updatePreview();
		});

		// Copy
		$('#template-copy-btn').click(function() {
			var msg = $previewBox.text();
			if (msg) {
				copyToClipboard(msg);
				$('#template-copy-text').text('\u2713');
				setTimeout(function() { $('#template-copy-text').text(copyLabel); }, 2000);
			}
		});

		// --- Init ---
		seedDefaults();
		migrateDefaults();
		if (getTemplates().length > 0) {
			showMainPanel();
		} else {
			showEmptyState();
		}
	});
})();
