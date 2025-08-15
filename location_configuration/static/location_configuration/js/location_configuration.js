/**
 * @file Manages the dynamic behavior of the Location Configuration page,
 * including modal forms, AJAX submissions, and UI updates. This script
 * uses a switchboard pattern to declaratively manage form preparation
 * and a single set of handlers for AJAX operations.
 */

// A global object to hold state for this page, like plugin instances.
const pageState = {
  addTypeIconPicker: null,
  editTypeIconPicker: null,
};

// =========================================================================
// === 1. ARCHITECTURE: SWITCHBOARD & PROTOCOL ENGINE
// =========================================================================

/**
 * The Switchboard: A pure configuration object that maps a modal's ID
 * to the specific functions responsible for preparing its form. This
 * declarative approach centralizes form setup logic, making it easier
 * to maintain and reason about.
 */
const FORM_CONFIG = {
  'add-type-modal': {
    onClear: genericClear,
    onConfigure: addTypeConfigure,
  },
  'edit-type-modal': {
    onClear: editTypeClear,
    onPopulate: editTypePopulate,
    onConfigure: editTypeConfigure,
  },
  'add-location-modal': {
    onClear: genericClear,
  },
  'add-child-location-modal': {
    onClear: genericClear,
    onPopulate: addChildPopulate,
  },
  'edit-location-modal': {
    onClear: genericClear,
    onPopulate: editLocationPopulate,
    onConfigure: editLocationConfigure,
  },
};

/**
 * The Protocol Engine: A function that executes a sequence of form
 * preparation steps (clear, populate, configure) based on a protocol
 * object retrieved from the switchboard.
 * @param {object} options - The options for running the protocol.
 * @param {HTMLFormElement} options.form - The form to be prepared.
 * @param {object} options.data - Data from the trigger element.
 * @param {object} options.protocol - A configuration object from FORM_CONFIG.
 */
async function runProtocol({ form, data, protocol }) {
  if (!protocol) return;

  if (protocol.onClear) protocol.onClear(form, data);
  if (protocol.onPopulate) await protocol.onPopulate(form, data);
  if (protocol.onConfigure) protocol.onConfigure(form, data);
}

// =========================================================================
// === 2. CORE LOGIC: EVENT HANDLERS
// =========================================================================

/**
 * Handles the click event for modal trigger buttons. This function serves as
 * the entry point for preparing and displaying a modal. It finds the correct
 * configuration in the switchboard and uses the protocol engine to execute it.
 * @param {Event} event - The click event.
 */
function handleModalTriggerClick(event) {
    const button = event.currentTarget;
    const modalId = button.dataset.modalTarget;
    const modal = document.querySelector(modalId);
    if (!modal) return;

    const form = modal.querySelector('form');
    const protocol = FORM_CONFIG[modalId.substring(1)];
    const data = button.dataset.actionInfo ? JSON.parse(button.dataset.actionInfo) : button.dataset;

    if (form && protocol) {
        runProtocol({ form, data, protocol });
    }

    modal.classList.add('is-active');
}

/**
 * Handles the submission of all modal forms. It uses the Fetch API to
 * submit the form data via AJAX, preventing a full page reload. On a
 * validation error, it preserves the user's input and displays the
 * error messages dynamically.
 * @param {Event} event - The form submission event.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;

    try {
        const response = await fetch(form.action, {
            method: form.method,
            body: new FormData(form),
            headers: { 'X-Requested-With': 'XMLHttpRequest' },
        });

        if (response.ok) {
            window.location.reload();
        } else if (response.status === 400) {
            const errorData = await response.json();
            displayFormErrors(form, errorData.errors);
        } else {
            console.error('An unexpected server error occurred:', response.statusText);
        }
    } catch (error) {
        console.error('Failed to submit form via AJAX:', error);
    }
}

// =========================================================================
// === 3. UTILITIES: UI & FORM HELPERS
// =========================================================================

/**
 * Renders validation errors inside the modal's form. It constructs an
 * error summary and applies error styling to the relevant form fields.
 * @param {HTMLFormElement} form - The form where errors will be displayed.
 * @param {object} errors - An object of errors returned from the server.
 */
function displayFormErrors(form, errors) {
    clearFormErrors(form);
    const summaryContainer = form.querySelector('.form-error-summary-container');
    if (!summaryContainer) return;

    let errorListHtml = '<ul>';
    for (const [field, messages] of Object.entries(errors)) {
        const fieldElement = form.querySelector(`[name="${field}"]`);
        fieldElement?.closest('.form-field')?.classList.add('has-error');
        const label = fieldElement?.closest('.form-field')?.querySelector('label')?.textContent || field;
        messages.forEach(msg => { errorListHtml += `<li>${label}: ${msg}</li>`; });
    }
    errorListHtml += '</ul>';

    summaryContainer.innerHTML = `
        <div class="form-error-summary">
            <p>Please correct the following errors:</p>
            ${errorListHtml}
        </div>
    `;
}

/** Clears all validation messages and error styling from a form. */
function clearFormErrors(form) {
    form.querySelector('.form-error-summary-container').innerHTML = '';
    form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
}

/** A generic onClear protocol step that resets a form and its errors. */
function genericClear(form) {
    clearFormErrors(form);
    form.reset();
    if (pageState.addTypeIconPicker) pageState.addTypeIconPicker.setChoiceByValue('warehouse');
}

// =========================================================================
// === 4. PROTOCOL IMPLEMENTATIONS: FORM-SPECIFIC LOGIC
// =========================================================================

/** Configures the grid inputs for the 'Add/Edit Location Type' form. */
function addTypeConfigure(form) {
    const hasSpacesCheckbox = form.querySelector('[name="has_spaces"]');
    const rowsInput = form.querySelector('[name="rows"]');
    const columnsInput = form.querySelector('[name="columns"]');

    const syncGridInputs = () => {
        const isChecked = hasSpacesCheckbox.checked;
        rowsInput.disabled = !isChecked;
        columnsInput.disabled = !isChecked;
        if (!isChecked) { rowsInput.value = ''; columnsInput.value = ''; }
    };
    syncGridInputs();
    hasSpacesCheckbox.addEventListener('change', syncGridInputs);
}

/** A custom onClear step for the edit type form to reset hidden/disabled parents. */
function editTypeClear(form) {
    genericClear(form); // Run the standard clear process first
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => {
        // Find the <label> that wraps the checkbox
        const parentContainer = cb.parentElement;
        if (parentContainer) {
            parentContainer.style.display = ''; // Make all options visible again
        }
        cb.disabled = false; // Re-enable the checkbox itself
    });
}

/** Populates the 'Edit Location Type' form with instance data. */
function editTypePopulate(form, data) {
    form.action = `/location_configuration/types/edit/${data.location_type_id}/`;
    form.querySelector('[name="name"]').value = data.name;
    form.querySelector('[name="can_store_inventory"]').checked = data.can_store_inventory;
    form.querySelector('[name="can_store_samples"]').checked = data.can_store_samples;
    form.querySelector('[name="has_spaces"]').checked = data.has_spaces;
    form.querySelector('[name="rows"]').value = data.rows || '';
    form.querySelector('[name="columns"]').value = data.columns || '';
    if (pageState.editTypeIconPicker) {
      pageState.editTypeIconPicker.setChoiceByValue(data.icon || 'warehouse');
    }
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => {
        cb.checked = data.allowed_parents.includes(parseInt(cb.value));
    });
}

/** Configures fields in the 'Edit Location Type' form based on its state. */
function editTypeConfigure(form, data) {
    const isInUse = data['is-in-use'];
    const hasSpacesCheckbox = form.querySelector('[name="has_spaces"]');

    // Rule #1: If the type is in use, the "Has Spaces" checkbox must be disabled.
    // This is done BEFORE calling the generic config to ensure it's respected.
    if (isInUse) {
        hasSpacesCheckbox.disabled = true;
    }

    // Now, run the generic configuration, which will correctly handle the state of the rows/columns fields.
    addTypeConfigure(form);

    // Continue with the rest of the configuration for allowed parents.
    form.querySelectorAll('input[name="allowed_parents"]').forEach(cb => {
        const id = parseInt(cb.value);
        const parentContainer = cb.parentElement;
        if (!parentContainer) return;

        // Hide parents that would cause a circular dependency
        if (data.invalid_parent_ids.includes(id)) {
            parentContainer.style.display = 'none';
        }
        // Disable parents that are currently in use
        else if (data.in_use_parent_type_ids.includes(id)) {
            cb.disabled = true;
        }
    });
}

/** Populates the 'Add Child Location' form, fetching valid child types. */
async function addChildPopulate(form, data) {
    // 1. Verify that the necessary data from the button's data attributes is present.
    if (!data.parentId || !data.parentName) {
        console.error("Add Child Modal: Missing parentId or parentName from the trigger button.", data);
        return;
    }

    // 2. Populate the static and hidden fields in the form.
    form.action = `/location_configuration/locations/add-child/`;
    form.querySelector('#parent-location-name-title').textContent = data.parentName;
    form.querySelector('[name="parent"]').value = data.parentId;
    form.querySelector('#parent-location-name-display').value = data.parentName;

    const select = form.querySelector('select[name="location_type"]');
    if (!select) {
        console.error("Add Child Modal: Could not find the location_type select element in the form.");
        return;
    }

    try {
        // 3. Fetch the list of valid child types from the server.
        const response = await fetch(`/location_configuration/get-child-types/${data.parentId}/`);
        if (!response.ok) {
            console.error("Failed to fetch child types. Server responded with status:", response.status);
            return;
        }
        const childTypes = await response.json();

        // 4. Build the dropdown options using a robust method.
        // Clear any existing options first.
        select.innerHTML = '';

        // Add a default, placeholder option.
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Select a location type';
        select.appendChild(placeholder);

        // Create and add an option for each valid child type returned by the server.
        childTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.id;
            option.textContent = type.name;
            select.appendChild(option);
        });

    } catch (error) {
        console.error("An error occurred while fetching or populating child location types:", error);
    }
}

/** Populates the 'Edit Location' form with details fetched from the server. */
async function editLocationPopulate(form, data) {
    form.action = `/location_configuration/locations/edit/${data.locationId}/`;
    const response = await fetch(`/location_configuration/get-location-details/${data.locationId}/`);
    const details = await response.json();
    form.dataset.hasChildren = details.has_children;
    form.querySelector('[name="name"]').value = details.name;

    const select = form.querySelector('select[name="location_type"]');
    select.innerHTML = '';
    details.valid_location_types.forEach(type => select.add(new Option(type.name, type.id)));
    select.value = details.current_location_type_id;
}

/** Configures the 'Edit Location' form, disabling the type if it has children. */
function editLocationConfigure(form) {
    const hasChildren = form.dataset.hasChildren === 'true';
    form.querySelector('select[name="location_type"]').disabled = hasChildren;
}

// =========================================================================
// === 5. INITIALIZATION
// =========================================================================

/** Returns the template functions for rendering icons in Choices.js. */
const getIconPickerTemplates = (template) => {
    const renderIcon = (data) => `<span class="material-symbols-outlined">${data.value}</span>`;
    return {
        item: (classNames, data) => template(`<div class="${classNames.item}" data-item data-id="${data.id}" data-value="${data.value}">${renderIcon(data)}</div>`),
        choice: (classNames, data) => template(`<div class="${classNames.item} ${classNames.itemChoice}" data-choice data-id="${data.id}" data-value="${data.value}">${renderIcon(data)}</div>`),
    };
};

/** Initializes the Choices.js icon picker plugins for the modals. */
const initIconPickers = () => {
    const addEl = document.querySelector('#add-type-modal .js-choice-icon-picker');
    if (addEl) pageState.addTypeIconPicker = new Choices(addEl, { searchEnabled: false, itemSelectText: '', callbackOnCreateTemplates: getIconPickerTemplates });

    const editEl = document.querySelector('#edit-type-modal .js-choice-icon-picker');
    if (editEl) pageState.editTypeIconPicker = new Choices(editEl, { searchEnabled: false, itemSelectText: '', callbackOnCreateTemplates: getIconPickerTemplates });
};

/** Attaches all necessary event listeners on page load. */
const initEventListeners = () => {
    // Attach listener to modal trigger buttons
    document.querySelectorAll('button[data-modal-target]').forEach(button => {
        if (button.dataset.modalTarget !== '#delete-confirmation-modal') {
            button.addEventListener('click', handleModalTriggerClick);
        }
    });
    // Attach listener to all modal forms for AJAX submission
    document.querySelectorAll('.modal-content form').forEach(form => {
        form.addEventListener('submit', handleFormSubmit);
    });
};

/** The main entry point for the script, executed after the DOM is loaded. */
document.addEventListener("DOMContentLoaded", () => {
    initIconPickers();
    initEventListeners();
});