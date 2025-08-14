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

/** Resets the "Edit Type" form to a pristine visual and data state. */
const editTypeClear = (form) => {
    // Run the generic clear to handle fields and error messages.
    genericClear(form);

    // Explicitly reset UI elements that are manipulated by editTypeConfigure.
    // This prevents state from a previous modal from "leaking" into the next.
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => {
        cb.disabled = false;
        cb.closest('label').style.display = '';
    });

    const hasSpacesCheckbox = form.querySelector('input[name="has_spaces"]');
    if (hasSpacesCheckbox) hasSpacesCheckbox.disabled = false;

    const rowsInput = form.querySelector('input[name="rows"]');
    if (rowsInput) rowsInput.disabled = true; // Should be disabled by default

    const columnsInput = form.querySelector('input[name="columns"]');
    if (columnsInput) columnsInput.disabled = true; // Should be disabled by default
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

/** Configures the "Add Type" form when it's re-rendered with errors. */
const configureAddTypeErrorForm = (form, data) => {
  formProtocol({ form, data, onConfigure: addTypeConfigure });
};

/** Configures the "Edit Type" form when it's re-rendered with errors. */
const configureEditTypeErrorForm = (form, data) => {
  if (!data) return;

  // Manually restore the `allowed_parents` checkbox state, which is lost on error.
  if (data.allowed_parents) {
    data.allowed_parents.forEach(id => {
      const cb = form.querySelector(`input[name="allowed_parents"][value="${id}"]`);
      if (cb) cb.checked = true;
    });
  }
  
  // With the checkboxes corrected, run the main configuration logic.
  formProtocol({ form, data, onConfigure: editTypeConfigure });
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

/** Configures the "Edit Location" form when it's re-rendered with errors. */
const configureEditLocationErrorForm = (form, data) => {
  if (form.dataset.hasChildren) {
    formProtocol({ form, data, onConfigure: editLocationConfigure });
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
    config = { ...config, data: JSON.parse(button.dataset.actionInfo), onClear: editTypeClear, onPopulate: editTypePopulate, onConfigure: editTypeConfigure };
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


/**
 * Handles the configuration of forms within modals that are opened automatically
 * on page load due to server-side validation errors.
 */
function handleFormErrorTrigger() {
  // A map linking modal IDs to their specific error-handling functions.
  const errorHandlers = {
    'add-type-modal': configureAddTypeErrorForm,
    'edit-type-modal': configureEditTypeErrorForm,
    'edit-location-modal': configureEditLocationErrorForm,
  };

  document.querySelectorAll('.modal-overlay[data-is-open-on-load]').forEach(modal => {
    const form = modal.querySelector('form');
    if (!form) return;

    // Find the correct handler for this modal, or do nothing if none exists.
    const handler = errorHandlers[modal.id];
    if (!handler) return;
    
    let data = null;
    if (modal.dataset.actionInfo) {
      try {
        data = JSON.parse(modal.dataset.actionInfo);
      } catch (e) {
        console.error(`Failed to parse action-info data on modal '${modal.id}':`, e);
        return; // Don't proceed without valid data
      }
    }
    
    // Execute the appropriate handler with the form and its data.
    handler(form, data);
  });
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

  // After the standard initializations, call the new handler to configure
  // any forms that were re-rendered with validation errors.
  handleFormErrorTrigger();
});