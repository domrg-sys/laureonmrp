// A global object to hold state for this page, like plugin instances.
const pageState = {
  addTypeIconPicker: null,
  editTypeIconPicker: null,
};

// =========================================================================
// === 1. PROTOCOL ENGINE
// =========================================================================

/**
 * A flexible engine that executes a sequence of protocol steps.
 * @param {object} options.form - The HTML form element.
 * @param {object} options.data - The initial data payload.
 * @param {object} options.protocol - The protocol object containing the steps to run.
 */
async function runProtocol({ form, data, protocol }) {
  if (!protocol) return;

  // Each step can modify the data for the next step.
  let currentData = { ...data };

  if (protocol.onScrape) {
    const scrapedData = protocol.onScrape(form);
    currentData = { ...currentData, ...scrapedData };
  }
  if (protocol.onClear) {
    protocol.onClear(form, currentData);
  }
  if (protocol.onPopulate) {
    await protocol.onPopulate(form, currentData);
  }
  if (protocol.onConfigure) {
    protocol.onConfigure(form, currentData);
  }
}

// =========================================================================
// === 2. SWITCHBOARD
// =========================================================================

const FORM_CONFIG = {
  'add-type-modal': {
    normal: {
      onClear: addTypeClear,
      onConfigure: addTypeConfigure,
    },
    error: {
      onConfigure: addTypeConfigure,
    },
  },
  'edit-type-modal': {
    normal: {
      onClear: editTypeClear,
      onPopulate: editTypePopulate,
      onConfigure: editTypeConfigure,
    },
    error: {
      // The specific, multi-step protocol for the error state.
      onScrape: scrapeEditTypeDataFromForm,
      onPopulate: editTypePopulate,
      onConfigure: editTypeConfigure,
    },
  },
  'add-location-modal': {
    normal: {
      onClear: genericClear,
    },
    error: {}, // No specific error protocol needed
  },
  'edit-location-modal': {
    normal: {
      onClear: genericClear,
      onPopulate: editLocationPopulate,
      onConfigure: editLocationConfigure,
    },
    error: {
      onPopulate: editLocationPopulate, // Must repopulate to get hasChildren flag
      onConfigure: editLocationConfigure,
    },
  },
  'add-child-location-modal': {
    normal: {
      onClear: genericClear,
      onPopulate: addChildPopulate,
    },
    error: {
      onPopulate: addChildPopulate, // Must repopulate to fetch child types
    },
  },
};

// =========================================================================
// === 3. PROTOCOLS
// =========================================================================

// --- A. For the "Location Type" Forms ---

const scrapeEditTypeDataFromForm = (form) => {
  const formData = new FormData(form);
  const allowedParents = formData.getAll('allowed_parents').map(Number);
  return {
    name: formData.get('name'),
    icon: formData.get('icon'),
    rows: formData.get('rows'),
    columns: formData.get('columns'),
    can_store_inventory: formData.has('can_store_inventory'),
    can_store_samples: formData.has('can_store_samples'),
    has_spaces: formData.has('has_spaces'),
    allowed_parents: allowedParents,
  };
};

const addTypeClear = (form) => {
  uiUtils.clearFormFields(form);
  uiUtils.clearFormErrors(form);
  if (pageState.addTypeIconPicker) pageState.addTypeIconPicker.setChoiceByValue('warehouse');
};

const addTypeConfigure = (form) => {
    const hasSpacesCheckbox = form.querySelector('input[name="has_spaces"]');
    const rowsInput = form.querySelector('input[name="rows"]');
    const columnsInput = form.querySelector('input[name="columns"]');
    const syncFields = () => {
        const isChecked = hasSpacesCheckbox.checked;
        rowsInput.disabled = !isChecked;
        columnsInput.disabled = !isChecked;
        if (!isChecked) { rowsInput.value = ''; columnsInput.value = ''; }
    };
    syncFields();
    if (!hasSpacesCheckbox.dataset.listenerAttached) {
        hasSpacesCheckbox.addEventListener('change', syncFields);
        hasSpacesCheckbox.dataset.listenerAttached = 'true';
    }
};

const editTypeClear = (form) => {
    genericClear(form);
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => {
        cb.disabled = false;
        cb.closest('label').style.display = '';
    });
    const hasSpacesCheckbox = form.querySelector('input[name="has_spaces"]');
    if (hasSpacesCheckbox) hasSpacesCheckbox.disabled = false;
    const rowsInput = form.querySelector('input[name="rows"]');
    if (rowsInput) rowsInput.disabled = true;
    const columnsInput = form.querySelector('input[name="columns"]');
    if (columnsInput) columnsInput.disabled = true;
};

const editTypePopulate = (form, data) => {
  form.querySelector('input[name="location_type_id"]').value = data.location_type_id;
  form.querySelector('input[name="name"]').value = data.name;
  form.querySelector('input[name="rows"]').value = data.rows || '';
  form.querySelector('input[name="columns"]').value = data.columns || '';
  form.querySelector('input[name="can_store_inventory"]').checked = data.can_store_inventory;
  form.querySelector('input[name="can_store_samples"]').checked = data.can_store_samples;
  form.querySelector('input[name="has_spaces"]').checked = data.has_spaces;
  if (pageState.editTypeIconPicker) pageState.editTypeIconPicker.setChoiceByValue(data.icon || 'warehouse');
  if (data.allowed_parents) {
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => cb.checked = false);
    data.allowed_parents.forEach(id => {
      const cb = form.querySelector(`input[name="allowed_parents"][value="${id}"]`);
      if (cb) cb.checked = true;
    });
  }
};

const editTypeConfigure = (form, data) => {
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => {
        cb.disabled = false;
        cb.closest('label').style.display = '';
    });
    if (data.invalid_parent_ids) data.invalid_parent_ids.forEach(id => {
        const cb = form.querySelector(`input[name="allowed_parents"][value="${id}"]`);
        if (cb) cb.closest('label').style.display = 'none';
    });
    if (data.in_use_parent_type_ids) data.in_use_parent_type_ids.forEach(id => {
        const cb = form.querySelector(`input[name="allowed_parents"][value="${id}"]`);
        if (cb) cb.disabled = true;
    });
    const isInUse = data['is-in-use'];
    const hasSpacesCheckbox = form.querySelector('input[name="has_spaces"]');
    const rowsInput = form.querySelector('input[name="rows"]');
    const columnsInput = form.querySelector('input[name="columns"]');
    const syncEditFields = () => {
        const isChecked = hasSpacesCheckbox.checked;
        rowsInput.disabled = isInUse || !isChecked;
        columnsInput.disabled = isInUse || !isChecked;
        if (!isChecked) { rowsInput.value = ''; columnsInput.value = ''; }
    };
    hasSpacesCheckbox.disabled = isInUse;
    syncEditFields();
    if (!hasSpacesCheckbox.dataset.listenerAttached) {
        hasSpacesCheckbox.addEventListener('change', syncEditFields);
        hasSpacesCheckbox.dataset.listenerAttached = 'true';
    }
};

// --- B. For the "Location" Forms ---

const addChildPopulate = async (form, data) => {
  const { parentId, parentName } = data;
  form.querySelector('#parent-location-name-title').textContent = parentName;
  form.querySelector('#parent-location-id').value = parentId;
  form.querySelector('#parent-location-name-display').value = parentName;
  const select = form.querySelector('select[name="location_type"]');
  try {
    const response = await fetch(`/location_configuration/get-child-types/${parentId}/`);
    const childTypes = await response.json();
    select.innerHTML = '<option value="">Select a location type</option>';
    childTypes.forEach(type => select.add(new Option(type.name, type.id)));
  } catch (error) {
    select.innerHTML = '<option>Could not load types</option>';
    console.error('Failed to fetch child location types:', error);
  }
};

const editLocationPopulate = async (form, data) => {
  const { locationId } = data;
  try {
    const response = await fetch(`/location_configuration/get-location-details/${locationId}/`);
    const details = await response.json();
    form.dataset.hasChildren = details.has_children;
    form.querySelector('input[name="name"]').value = details.name;
    form.querySelector('input[name="location_id"]').value = locationId;
    const select = form.querySelector('select[name="location_type"]');
    select.innerHTML = '';
    details.valid_location_types.forEach(type => select.add(new Option(type.name, type.id)));
    select.value = details.current_location_type_id;
  } catch (error) { console.error("Error populating edit location form:", error); }
};

const editLocationConfigure = (form) => {
  const hasChildren = form.dataset.hasChildren === 'true';
  const select = form.querySelector('select[name="location_type"]');
  if (select) select.disabled = hasChildren;
};

const configureEditLocationErrorForm = (form, data) => runProtocol({ form, data, protocol: FORM_CONFIG[form.closest('.modal-overlay').id].error });


// --- C. Generic & Reusable Strategies ---

const genericClear = (form) => {
  uiUtils.clearFormFields(form);
  uiUtils.clearFormErrors(form);
};


// =========================================================================
// === 4. EVENT HANDLERS (Driven by the Switchboard & Protocol Engine)
// =========================================================================

function handleFormModalTriggerClick(event) {
  event.preventDefault();
  const button = this;
  const modalId = button.dataset.modalTarget.substring(1);
  const modal = document.getElementById(modalId);
  if (!modal) return;
  const formConfig = FORM_CONFIG[modalId];
  if (!formConfig || !formConfig.normal) return;

  const form = modal.querySelector('form');
  const data = button.dataset.actionInfo ? JSON.parse(button.dataset.actionInfo) : button.dataset;

  runProtocol({ form, data, protocol: formConfig.normal });
  modal.classList.add('is-active');
}

function handleFormErrorTrigger() {
  document.querySelectorAll('.modal-overlay[data-is-open-on-load]').forEach(modal => {
    const formConfig = FORM_CONFIG[modal.id];
    if (formConfig && formConfig.error) {
      const form = modal.querySelector('form');
      const data = modal.dataset.actionInfo ? JSON.parse(modal.dataset.actionInfo) : null;
      runProtocol({ form, data, protocol: formConfig.error });
    }
  });
}

// =========================================================================
// === 5. INITIALIZERS
// =========================================================================

const getIconPickerTemplates = (template) => {
  const renderIcon = (data) => `<span class="material-symbols-outlined">${data.value}</span>`;
  return {
    item: (classNames, data) => template(`<div class="${classNames.item}" data-item data-id="${data.id}" data-value="${data.value}">${renderIcon(data)}</div>`),
    choice: (classNames, data) => template(`<div class="${classNames.item} ${classNames.itemChoice}" data-choice data-id="${data.id}" data-value="${data.value}">${renderIcon(data)}</div>`),
  };
};

const initAddIconPicker = () => {
  const el = document.querySelector('#add-type-modal .js-choice-icon-picker');
  if (el) pageState.addTypeIconPicker = new Choices(el, { searchEnabled: false, itemSelectText: '', callbackOnCreateTemplates: getIconPickerTemplates });
};

const initEditIconPicker = () => {
  const el = document.querySelector('#edit-type-modal .js-choice-icon-picker');
  if (el) pageState.editTypeIconPicker = new Choices(el, { searchEnabled: false, itemSelectText: '', callbackOnCreateTemplates: getIconPickerTemplates });
};

const initFormModalTriggers = () => {
  document.querySelectorAll('button[data-modal-target]:not([data-modal-target="#delete-confirmation-modal"])').forEach(button => {
    button.addEventListener('click', handleFormModalTriggerClick);
  });
};

// =========================================================================
// === 6. MAIN EXECUTION
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  initProtocol([
    initAddIconPicker,
    initEditIconPicker,
    initFormModalTriggers
  ]);

  handleFormErrorTrigger();
});