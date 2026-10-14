(function() {
	var STORAGE_KEY = 'wf-templates';
	var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
	var PAGE_SIZE = 20;
	var locale = window.__bulksenderLocale || {};

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
					{ name: 'Items', type: 'text' },
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

	function parseFields(body) {
		var fields = [];
		var regex = /\{([^}]+)\}/g;
		var match;
		var seen = {};
		while ((match = regex.exec(body)) !== null) {
			var name = match[1];
			if (!seen[name]) {
				seen[name] = true;
				var type = 'text';
				if (name === 'Date') type = 'date';
				else if (name === 'Time') type = 'time';
				else if (name === 'Day') type = 'day';
				fields.push({ name: name, type: type });
			}
		}
		return fields;
	}

	function getAutoFillValue(type) {
		var now = new Date();
		if (type === 'date') return now.getDate() + ' ' + MONTHS[now.getMonth()] + ' ' + now.getFullYear();
		if (type === 'time') {
			var h = now.getHours(), m = now.getMinutes(), ampm = h >= 12 ? 'PM' : 'AM';
			h = h % 12 || 12;
			return (h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m) + ' ' + ampm;
		}
		if (type === 'day') return DAYS[now.getDay()];
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

	function escapeHtml(str) {
		return $('<span>').text(str).html();
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

	function renderModalPreview(body) {
		var $box = $('#modal-preview-box');
		if (!body.trim()) {
			$box.html('<span class="template-modal-preview-empty">Start typing to see preview...</span>');
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

	$(document).ready(function() {
		var $createPanel = $('#bulksender-create-panel');
		var $wizard = $('#bulksender-wizard');
		var $modal = $('#template-modal');
		var currentTemplate = null;
		var csvHeaders = [];
		var csvRows = [];
		var generatedMessages = [];
		var visibleCount = 0;
		var copyAllLabel = locale.copyAll || 'Copy All';
		var copyOneLabel = locale.copyOne || 'Copy';
		var sendOneLabel = locale.sendOne || 'Send';
		var rowsLoadedLabel = locale.rowsLoaded || '{count} rows loaded';
		var rowsLoadedOneLabel = locale.rowsLoadedOne || '{count} row loaded';
		var localeLang = locale.lang || 'en';

		/*
		 * The count used to be glued on in front: csvRows.length + ' ' + label.
		 * That fixes the numeral to the left of the noun and leaves the noun in
		 * one form, which no language with agreement can use. Arabic had to pick a
		 * single form and chose the one correct from eleven upwards; Spanish,
		 * French and Italian agree their participle with the number; Turkish,
		 * Indonesian and Malay do not inflect after a numeral at all.
		 *
		 * The string now carries {count}, so each language puts the number where
		 * it belongs, and Intl.PluralRules picks the singular where there is one.
		 * Arabic's three-to-ten form is still not modelled: that needs the "few"
		 * category and a third string.
		 */
		function rowsLoadedText(count) {
			var form = 'other';
			try {
				form = new Intl.PluralRules(localeLang).select(count);
			} catch (e) {}
			var template = form === 'one' ? rowsLoadedOneLabel : rowsLoadedLabel;
			return template.replace('{count}', count);
		}
		var phoneColumnLabel = locale.phoneColumn || 'Phone Number Column';

		// --- Modal ---
		function openModal() {
			$('#modal-template-name').val('');
			$('#modal-template-body').val('');
			$('#modal-custom-row').hide();
			renderModalPreview('');
			$modal.show();
		}

		function closeModal() {
			$modal.hide();
		}

		$('#bulksender-create-first-btn').click(openModal);
		$('#bulksender-new-template-btn').click(openModal);
		$('#template-modal-close').click(closeModal);
		$modal.click(function(e) {
			if (e.target === this) closeModal();
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

		$('#modal-custom-add').click(function() {
			var fieldName = $('#modal-custom-name').val().trim();
			if (fieldName) {
				var textarea = document.getElementById('modal-template-body');
				insertAtCursor(textarea, '{' + fieldName + '}');
				renderModalPreview(textarea.value);
			}
			$('#modal-custom-row').hide();
			$('#modal-custom-name').val('');
		});

		$('#modal-custom-cancel').click(function() {
			$('#modal-custom-row').hide();
			$('#modal-custom-name').val('');
		});

		$('#modal-custom-name').keypress(function(e) {
			if (e.which === 13) {
				$('#modal-custom-add').click();
			}
		});

		$('#modal-template-body').on('input', function() {
			renderModalPreview($(this).val());
		});

		// Save from modal
		$('#modal-template-save').click(function() {
			var name = $('#modal-template-name').val().trim();
			var body = $('#modal-template-body').val().trim();
			if (!name || !body) return;

			var fields = parseFields(body);
			var templates = getTemplates();
			var newId = generateId();
			templates.push({
				id: newId,
				name: name,
				body: body,
				fields: fields,
				createdAt: new Date().toISOString().split('T')[0]
			});
			saveTemplates(templates);
			closeModal();

			showWizard(newId);
		});

		// --- Page state ---
		function showCreatePanel() {
			$createPanel.show();
			$wizard.hide();
		}

		function showWizard(autoSelectId) {
			$createPanel.hide();
			$wizard.show();
			loadTemplates();
			if (autoSelectId) {
				$('#bulksender-template-select').val(autoSelectId).change();
			}
		}

		// --- Wizard Logic ---
		function loadTemplates() {
			var templates = getTemplates();
			var $select = $('#bulksender-template-select');
			$select.find('option:not(:first)').remove();

			templates.forEach(function(t) {
				$select.append('<option value="' + t.id + '">' + escapeHtml(t.name) + '</option>');
			});
		}

		$('#bulksender-template-select').change(function() {
			var id = $(this).val();
			if (!id) {
				currentTemplate = null;
				$('#bulksender-template-preview').hide();
				$('#bulksender-step2').hide();
				$('#bulksender-step3').hide();
				$('#bulksender-step4').hide();
				return;
			}
			currentTemplate = getTemplates().find(function(t) { return t.id === id; });
			if (currentTemplate) {
				$('#bulksender-template-body').text(currentTemplate.body);
				$('#bulksender-template-preview').show();
				$('#bulksender-step2').show();
				resetDataImport();
			}
		});

		// Step 2: Import tabs
		$('.bulksender-tab').click(function() {
			$('.bulksender-tab').removeClass('active');
			$(this).addClass('active');
			var tab = $(this).data('tab');
			$('.bulksender-tab-content').hide();
			$('#tab-' + tab).show();
		});

		function resetDataImport() {
			csvHeaders = [];
			csvRows = [];
			$('#bulksender-step3').hide();
			$('#bulksender-step4').hide();
			$('#bulksender-data-status').hide();
		}

		function handleParsedData(results) {
			if (!results.data || results.data.length === 0) {
				showStatus('No data found in the file.', 'error');
				return;
			}
			csvHeaders = results.meta.fields || [];
			csvRows = results.data.filter(function(row) {
				return Object.values(row).some(function(v) { return v && v.trim(); });
			});

			if (csvHeaders.length === 0 || csvRows.length === 0) {
				showStatus('No valid data found. Make sure your CSV has headers.', 'error');
				return;
			}

			showStatus(rowsLoadedText(csvRows.length), 'success');
			buildMappingUI();
			$('#bulksender-step3').show();
		}

		function showStatus(msg, type) {
			var $status = $('#bulksender-data-status');
			$status.text(msg).show();
			$status.removeClass('status-success status-error');
			$status.addClass(type === 'success' ? 'status-success' : 'status-error');
		}

		$('#bulksender-file').change(function() {
			var file = this.files[0];
			if (!file) return;
			Papa.parse(file, { header: true, skipEmptyLines: true, complete: handleParsedData });
		});

		var $zone = $('#bulksender-upload-zone');
		$zone.on('dragover', function(e) { e.preventDefault(); $(this).addClass('dragover'); });
		$zone.on('dragleave drop', function() { $(this).removeClass('dragover'); });
		$zone.on('drop', function(e) {
			e.preventDefault();
			var file = e.originalEvent.dataTransfer.files[0];
			if (file) Papa.parse(file, { header: true, skipEmptyLines: true, complete: handleParsedData });
		});

		$('#bulksender-parse-paste').click(function() {
			var text = $('#bulksender-paste').val().trim();
			if (!text) return;
			Papa.parse(text, { header: true, skipEmptyLines: true, complete: handleParsedData });
		});

		$('#bulksender-fetch-sheets').click(function() {
			var url = $('#bulksender-sheets-url').val().trim();
			if (!url) return;

			var match = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
			if (!match) {
				showStatus('Invalid Google Sheets URL. Please paste a valid sheet URL.', 'error');
				return;
			}

			var csvUrl = 'https://docs.google.com/spreadsheets/d/' + match[1] + '/export?format=csv';
			showStatus('Fetching sheet data...', 'success');

			fetch(csvUrl)
				.then(function(res) {
					if (!res.ok) throw new Error('Failed to fetch');
					return res.text();
				})
				.then(function(text) {
					Papa.parse(text, { header: true, skipEmptyLines: true, complete: handleParsedData });
				})
				.catch(function() {
					showStatus('Could not fetch the sheet. Make sure it is published: File > Share > Publish to web.', 'error');
				});
		});

		function buildMappingUI() {
			if (!currentTemplate) return;
			var html = '';

			html += '<div class="bulksender-mapping-row">' +
				'<label class="bulksender-mapping-label"><i class="fas fa-phone"></i> ' + phoneColumnLabel + '</label>' +
				'<select class="bulksender-mapping-select" data-field="__phone__">' +
				'<option value="">-- Select --</option>';
			csvHeaders.forEach(function(h) {
				var selected = h.toLowerCase().match(/phone|mobile|number|whatsapp/) ? ' selected' : '';
				html += '<option value="' + escapeHtml(h) + '"' + selected + '>' + escapeHtml(h) + '</option>';
			});
			html += '</select></div>';

			currentTemplate.fields.forEach(function(field) {
				var isAuto = field.type === 'date' || field.type === 'time' || field.type === 'day';
				html += '<div class="bulksender-mapping-row">' +
					'<label class="bulksender-mapping-label">' + escapeHtml(field.name) +
					(isAuto ? ' <span class="template-auto-badge">Auto</span>' : '') +
					'</label>' +
					'<select class="bulksender-mapping-select" data-field="' + escapeHtml(field.name) + '">' +
					'<option value="__auto__"' + (isAuto ? ' selected' : '') + '>Auto-fill</option>' +
					'<option value="">-- Skip --</option>';
				csvHeaders.forEach(function(h) {
					var selected = !isAuto && h.toLowerCase() === field.name.toLowerCase() ? ' selected' : '';
					html += '<option value="' + escapeHtml(h) + '"' + selected + '>' + escapeHtml(h) + '</option>';
				});
				html += '</select></div>';
			});

			$('#bulksender-mapping').html(html);
		}

		$('#bulksender-generate-btn').click(function() {
			if (!currentTemplate || csvRows.length === 0) return;

			var phoneCol = $('[data-field="__phone__"]').val();
			var fieldMapping = {};
			currentTemplate.fields.forEach(function(field) {
				var col = $('[data-field="' + field.name + '"]').val();
				fieldMapping[field.name] = col;
			});

			generatedMessages = [];
			csvRows.forEach(function(row) {
				var fieldValues = {};
				currentTemplate.fields.forEach(function(field) {
					var col = fieldMapping[field.name];
					if (col === '__auto__') {
						fieldValues[field.name] = getAutoFillValue(field.type);
					} else if (col) {
						fieldValues[field.name] = row[col] || '';
					} else {
						fieldValues[field.name] = '';
					}
				});

				var phone = phoneCol ? (row[phoneCol] || '') : '';
				var msg = composeMessage(currentTemplate.body, currentTemplate.fields, fieldValues);
				generatedMessages.push({ phone: phone, message: msg });
			});

			visibleCount = 0;
			$('#bulksender-messages-list').empty();
			$('#bulksender-count').text(generatedMessages.length);
			loadMoreMessages();
			$('#bulksender-step4').show();

			$('html, body').animate({ scrollTop: $('#bulksender-step4').offset().top - 100 }, 300);
		});

		function loadMoreMessages() {
			var end = Math.min(visibleCount + PAGE_SIZE, generatedMessages.length);
			var $list = $('#bulksender-messages-list');

			for (var i = visibleCount; i < end; i++) {
				var item = generatedMessages[i];
				var waLink = item.phone ? 'https://wa.me/' + item.phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(item.message) : '#';
				var card = '<div class="bulksender-message-card">' +
					'<div class="bulksender-message-header">' +
					'<span class="bulksender-message-index">#' + (i + 1) + '</span>' +
					(item.phone ? '<span class="bulksender-message-phone"><i class="fas fa-phone"></i> ' + escapeHtml(item.phone) + '</span>' : '') +
					'</div>' +
					'<div class="bulksender-message-body">' + escapeHtml(item.message) + '</div>' +
					'<div class="bulksender-message-actions">' +
					'<button class="bulksender-copy-one" data-index="' + i + '"><i class="fas fa-copy"></i> ' + copyOneLabel + '</button>' +
					(item.phone ? '<a href="' + waLink + '" target="_blank" class="bulksender-send-one"><i class="fab fa-whatsapp"></i> ' + sendOneLabel + '</a>' : '') +
					'</div></div>';
				$list.append(card);
			}

			visibleCount = end;
			if (visibleCount < generatedMessages.length) {
				$('#bulksender-show-more').show();
			} else {
				$('#bulksender-show-more').hide();
			}
		}

		$('#bulksender-load-more').click(loadMoreMessages);

		$('#bulksender-messages-list').on('click', '.bulksender-copy-one', function() {
			var idx = $(this).data('index');
			copyToClipboard(generatedMessages[idx].message);
			var $btn = $(this);
			$btn.html('<i class="fas fa-check"></i> Copied');
			setTimeout(function() { $btn.html('<i class="fas fa-copy"></i> ' + copyOneLabel); }, 2000);
		});

		$('#bulksender-copy-all').click(function() {
			var allText = generatedMessages.map(function(item, i) {
				var header = item.phone ? '(' + item.phone + ')' : '(#' + (i + 1) + ')';
				return header + '\n' + item.message;
			}).join('\n---\n');
			copyToClipboard(allText);
			$('#bulksender-copy-all-text').text('\u2713');
			setTimeout(function() { $('#bulksender-copy-all-text').text(copyAllLabel); }, 2000);
		});

		// --- Init ---
		seedDefaults();
		if (getTemplates().length > 0) {
			showWizard();
		} else {
			showCreatePanel();
		}
	});
})();
