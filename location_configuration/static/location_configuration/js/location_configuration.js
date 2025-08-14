// A global object to hold state for this page, like plugin instances.
const pageState = {
  addTypeIconPicker: null,
  editTypeIconPicker: null,
};


// =========================================================================
// === 1. FORM PREPARATION HELPERS (Strategies for the `formProtocol`)
// =========================================================================

// --- A. For the "Location Type" Forms ---

/** Clears and resets the "Add Type" form to its default state. */
const addTypeClear = (form) => {
  uiUtils.clearFormFields(form);
  uiUtils.clearFormErrors(form);
  if (pageState.addTypeIconPicker) {
    pageState.addTypeIconPicker.setChoiceByValue('warehouse');
  }
};

/** Configures the "Add Type" form fields based on checkbox states. */
const addTypeConfigure = (form) => {
    const hasSpacesCheckbox = form.querySelector('input[name="has_spaces"]');
    const rowsInput = form.querySelector('input[name="rows"]');
    const columnsInput = form.querySelector('input[name="columns"]');

    const syncFields = () => {
        const isChecked = hasSpacesCheckbox.checked;
        rowsInput.disabled = !isChecked;
        columnsInput.disabled = !isChecked;
        if (!isChecked) {
            rowsInput.value = '';
            columnsInput.value = '';
        }
    };

    // Run once to set the initial state when the modal opens.
    syncFields();

    // Attach the listener for live interaction.
    if (!hasSpacesCheckbox.dataset.listenerAttached) {
        hasSpacesCheckbox.addEventListener('change', syncFields);
        hasSpacesCheckbox.dataset.listenerAttached = 'true';
    }
};

/** Populates the "Edit Type" form with data from the server. */
const editTypePopulate = (form, data) => {
  form.querySelector('input[name="location_type_id"]').value = data.location_type_id;
  form.querySelector('input[name="name"]').value = data.name;
  form.querySelector('input[name="rows"]').value = data.rows || '';
  form.querySelector('input[name="columns"]').value = data.columns || '';
  form.querySelector('input[name="can_store_inventory"]').checked = data.can_store_inventory;
  form.querySelector('input[name="can_store_samples"]').checked = data.can_store_samples;
  form.querySelector('input[name="has_spaces"]').checked = data.has_spaces;

  if (pageState.editTypeIconPicker) {
    pageState.editTypeIconPicker.setChoiceByValue(data.icon || 'warehouse');
  }
  if (data.allowed_parents) {
    data.allowed_parents.forEach(id => {
      const cb = form.querySelector(`input[name="allowed_parents"][value="${id}"]`);
      if (cb) cb.checked = true;
    });
  }
};

/** Configures the "Edit Type" form fields based on complex rules. */
const editTypeConfigure = (form, data) => {
    // --- Parent checkbox logic ---
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => {
        cb.disabled = false;
        cb.closest('label').style.display = '';
    });
    if (data.invalid_parent_ids) {
        data.invalid_parent_ids.forEach(id => {
            const cb = form.querySelector(`input[name="allowed_parents"][value="${id}"]`);
            if (cb) cb.closest('label').style.display = 'none';
        });
    }
    if (data.in_use_parent_type_ids) {
        data.in_use_parent_type_ids.forEach(id => {
            const cb = form.querySelector(`input[name="allowed_parents"][value="${id}"]`);
            if (cb) cb.disabled = true;
        });
    }

    // --- "Has Spaces" logic ---
    const isInUse = data['is-in-use'];
    const hasSpacesCheckbox = form.querySelector('input[name="has_spaces"]');
    const rowsInput = form.querySelector('input[name="rows"]');
    const columnsInput = form.querySelector('input[name="columns"]');

    const syncEditFields = () => {
        const isChecked = hasSpacesCheckbox.checked;
        rowsInput.disabled = isInUse || !isChecked;
        columnsInput.disabled = isInUse || !isChecked;
        if (!isChecked) {
            rowsInput.value = '';
            columnsInput.value = '';
        }
    };

    hasSpacesCheckbox.disabled = isInUse;
    syncEditFields();

    if (!hasSpacesCheckbox.dataset.listenerAttached) {
        hasSpacesCheckbox.addEventListener('change', syncEditFields);
        hasSpacesCheckbox.dataset.listenerAttached = 'true';
    }
};


// --- B. For the "Location" Forms ---

/** Populates the "Add Child" form and fetches valid child types. */
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

/** Populates the "Edit Location" form by fetching its details. */
const editLocationPopulate = async (form, data) => {
  const { locationId } = data;
  try {
    const response = await fetch(`/location_configuration/get-location-details/${locationId}/`);
    const details = await response.json();

    // Store has_children on the form's dataset so the configure function can access it.
    form.dataset.hasChildren = details.has_children;

    form.querySelector('input[name="name"]').value = details.name;
    form.querySelector('input[name="location_id"]').value = locationId;

    const select = form.querySelector('select[name="location_type"]');
    select.innerHTML = ''; // Clear old options
    details.valid_location_types.forEach(type => select.add(new Option(type.name, type.id)));
    select.value = details.current_location_type_id;
  } catch (error) {
    console.error("Error populating edit location form:", error);
  }
};

/** Configures the "Edit Location" form after it has been populated. */
const editLocationConfigure = (form) => {
  const hasChildren = form.dataset.hasChildren === 'true';
  const select = form.querySelector('select[name="location_type"]');
  if (select) {
    select.disabled = hasChildren;
  }
};


// --- C. Generic & Reusable Strategies ---

/** A simple, reusable clear strategy for most forms on this page. */
const genericClear = (form) => {
  uiUtils.clearFormFields(form);
  uiUtils.clearFormErrors(form);
};


// =========================================================================
// === 2. EVENT HANDLERS
// =========================================================================

/** Handles clicks on buttons that open a form modal. */
function handleFormModalTriggerClick(event) {
  event.preventDefault();
  const button = this;
  const modalTarget = button.dataset.modalTarget;
  const modal = document.querySelector(modalTarget);
  if (!modal) return;

  const form = modal.querySelector('form');
  let config = { form };

  // Determine the correct protocol configuration based on which button was clicked.
  if (modalTarget === '#add-type-modal') {
    config = { ...config, onClear: addTypeClear, onConfigure: addTypeConfigure };
  }
  else if (modalTarget === '#edit-type-modal') {
    config = { ...config, data: JSON.parse(button.dataset.actionInfo), onClear: genericClear, onPopulate: editTypePopulate, onConfigure: editTypeConfigure };
  }
  else if (modalTarget === '#add-location-modal'){
    config = { ...config, onClear: genericClear };
  }
  else if (modalTarget === '#edit-location-modal') {
    config = { ...config, data: { locationId: button.dataset.locationId }, onClear: genericClear, onPopulate: editLocationPopulate, onConfigure: editLocationConfigure };
  }
  else if (modalTarget === '#add-child-location-modal') {
    config = { ...config, data: { parentId: button.dataset.parentId, parentName: button.dataset.parentName }, onClear: genericClear, onPopulate: addChildPopulate };
  }

  formProtocol(config);
  modal.classList.add('is-active');
}


// =========================================================================
// === 3. INITIALIZERS (Strategies for the `initProtocol`)
// =========================================================================

/** A helper to generate the HTML templates for our icon picker. */
const getIconPickerTemplates = (template) => {
  // A single template for rendering the icon ONLY.
  const renderIcon = (data) => `
    <span class="material-symbols-outlined">${data.value}</span>
  `;

  return {
    item: (classNames, data) => template(
      `<div class="${classNames.item}" data-item data-id="${data.id}" data-value="${data.value}">${renderIcon(data)}</div>`
    ),
    choice: (classNames, data) => template(
      `<div class="${classNames.item} ${classNames.itemChoice}" data-choice data-id="${data.id}" data-value="${data.value}">${renderIcon(data)}</div>`
    ),
  };
};

/** Creates the Choices.js instance for the "Add Type" modal's icon picker. */
const initAddIconPicker = () => {
  const el = document.querySelector('#add-type-modal .js-choice-icon-picker');
  if (el) {
    pageState.addTypeIconPicker = new Choices(el, {
      searchEnabled: false,
      itemSelectText: '',
      callbackOnCreateTemplates: getIconPickerTemplates,
    });
  }
};

/** Creates the Choices.js instance for the "Edit Type" modal's icon picker. */
const initEditIconPicker = () => {
  const el = document.querySelector('#edit-type-modal .js-choice-icon-picker');
  if (el) {
    pageState.editTypeIconPicker = new Choices(el, {
      searchEnabled: false,
      itemSelectText: '',
      callbackOnCreateTemplates: getIconPickerTemplates,
    });
  }
};

/** Attaches the main event handler to all form-opening buttons. */
const initFormModalTriggers = () => {
  const formTriggers = document.querySelectorAll('button[data-modal-target]:not([data-modal-target="#delete-confirmation-modal"])');
  formTriggers.forEach(button => {
    button.addEventListener('click', handleFormModalTriggerClick);
  });
};


// =========================================================================
// === 4. MAIN EXECUTION
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  initProtocol([
    initAddIconPicker,
    initEditIconPicker,
    initFormModalTriggers
  ]);
});