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
// === 1. ARCHITECTURE & CORE LOGIC
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
    onClear: addChildClear,
    onPopulate: addChildPopulate,
  },
  'edit-location-modal': {
    onClear: editLocationClear,
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
// === 2. EVENT HANDLERS
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
    saveTreeState();

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

/**
 * Handles the click event for a location node toggle button.
 * @param {Event} event - The click event.
 */
function handleLocationNodeToggle(event) {
    const button = event.currentTarget;
    const childrenContainer = button.closest('.location-node').querySelector('.location-node-children');

    if (!childrenContainer) return;

    // Toggle the class that hides/shows the children container.
    const isCollapsed = childrenContainer.classList.toggle('is-collapsed');

    // Also toggle a class on the button itself for styling.
    button.classList.toggle('is-expanded', !isCollapsed);

    // If it's collapsed, use the right arrow. If it's open, use the down arrow.
    button.querySelector('.material-symbols-outlined').textContent = isCollapsed ? 'chevron_right' : 'expand_more';
}

// =========================================================================
// === 3. UI & DOM UTILITIES
// =========================================================================

/**
 * Renders validation errors inside the modal's form. It constructs an
 * error summary and applies error styling to the relevant form fields.
 * @param {HTMLFormElement} form - The form where errors will be displayed.
 * @param {object} errors - An object of errors returned from the server.
 */
function displayFormErrors(form, errors) {
    clearFormErrors(form);
    const modalBody = form.closest('.modal-body');
    if (modalBody) {
        modalBody.scrollTop = 0;
    }
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

/**
 * Fetches data for and renders the location grid if the parent has spaces.
 */
async function populateLocationGrid(form, parentId) {
    const gridContainer = form.querySelector('#location-grid-container');
    gridContainer.style.display = 'none'; // Hide and clear by default
    gridContainer.innerHTML = '';

    const response = await fetch(`/location_configuration/get-location-grid/${parentId}/`);
    const gridData = await response.json();

    if (!gridData.has_spaces) return; // Exit if the parent doesn't have a grid

    // Create and display the grid
    gridContainer.style.display = 'block';
    const gridEl = document.createElement('div');
    gridEl.className = 'location-grid';
    gridEl.style.gridTemplateColumns = `repeat(${gridData.columns}, 1fr)`;

    gridData.grid.flat().forEach(cell => {
        const cellEl = document.createElement('div');
        cellEl.className = 'location-grid-cell';
        if (cell.is_occupied) {
            cellEl.classList.add('is-occupied');
            cellEl.textContent = cell.occupant_name;
            cellEl.title = `Occupied by: ${cell.occupant_name}`;
        } else {
            cellEl.textContent = `R${cell.row} C${cell.column}`;
            cellEl.dataset.row = cell.row;
            cellEl.dataset.column = cell.column;
        }
        gridEl.appendChild(cellEl);
    });

    // Add a single event listener to the grid container
    gridEl.addEventListener('click', (e) => {
        const clickedCell = e.target.closest('.location-grid-cell');
        if (!clickedCell || clickedCell.classList.contains('is-occupied')) return;

        gridEl.querySelector('.is-selected')?.classList.remove('is-selected');
        clickedCell.classList.add('is-selected');

        form.querySelector('input[name="row"]').value = clickedCell.dataset.row;
        form.querySelector('input[name="column"]').value = clickedCell.dataset.column;
    });

    gridContainer.appendChild(gridEl);
}

/**
 * Expands all nodes in the location tree.
 */
function expandAllNodes() {
    document.querySelectorAll('.location-node-children.is-collapsed').forEach(container => {
        container.classList.remove('is-collapsed');
    });
    document.querySelectorAll('.location-node-toggle').forEach(button => {
        button.classList.add('is-expanded');
        button.querySelector('.material-symbols-outlined').textContent = 'expand_more';
    });
}

/**
 * Collapses all nodes in the location tree.
 */
function collapseAllNodes() {
    document.querySelectorAll('.location-node-children:not(.is-collapsed)').forEach(container => {
        container.classList.add('is-collapsed');
    });
    document.querySelectorAll('.location-node-toggle').forEach(button => {
        button.classList.remove('is-expanded');
        button.querySelector('.material-symbols-outlined').textContent = 'chevron_right';
    });
}

/**
 * Saves the expanded state of the location tree to session storage.
 */
function saveTreeState() {
    const expandedNodeIds = [];
    document.querySelectorAll('.location-node-toggle.is-expanded').forEach(button => {
        const nodeId = button.closest('.location-node').dataset.locationId;
        if (nodeId) {
            expandedNodeIds.push(nodeId);
        }
    });
    sessionStorage.setItem('expandedLocationNodes', JSON.stringify(expandedNodeIds));
}

/**
 * Restores the expanded state of the location tree from session storage.
 */
function restoreTreeState() {
    const expandedNodeIds = JSON.parse(sessionStorage.getItem('expandedLocationNodes'));
    if (!expandedNodeIds || !Array.isArray(expandedNodeIds)) {
        return;
    }

    expandedNodeIds.forEach(nodeId => {
        const node = document.querySelector(`.location-node[data-location-id="${nodeId}"]`);
        if (node) {
            const childrenContainer = node.querySelector('.location-node-children');
            const button = node.querySelector('.location-node-toggle');
            if (childrenContainer && button) {
                childrenContainer.classList.remove('is-collapsed');
                button.classList.add('is-expanded');
                button.querySelector('.material-symbols-outlined').textContent = 'expand_more';
            }
        }
    });

    sessionStorage.removeItem('expandedLocationNodes');
}

// =========================================================================
// === 4. FORM PROTOCOL IMPLEMENTATIONS
// =========================================================================

// --- Generic Protocols ---

/** A generic onClear protocol step that resets a form and its errors. */
function genericClear(form) {
    clearFormErrors(form);
    form.reset();
    if (pageState.addTypeIconPicker) pageState.addTypeIconPicker.setChoiceByValue('warehouse');
}

// --- Location Type Protocols ---

/** Configures the grid inputs for the 'Add/Edit Location Type' form. */
function addTypeConfigure(form) {
    const hasSpacesCheckbox = form.querySelector('[name="has_spaces"]');
    const rowsInput = form.querySelector('[name="rows"]');
    const columnsInput = form.querySelector('[name="columns"]');

    const syncGridInputs = () => {
        const isChecked = hasSpacesCheckbox.checked;
        const isCheckboxDisabled = hasSpacesCheckbox.disabled;

        // Disable grid inputs if the checkbox is unchecked OR if the checkbox itself is disabled.
        const shouldDisableGridInputs = !isChecked || isCheckboxDisabled;
        rowsInput.disabled = shouldDisableGridInputs;
        columnsInput.disabled = shouldDisableGridInputs;

        // Only clear the values if the user unchecks the box themselves.
        // Do not clear if the box is disabled.
        if (!isChecked && !isCheckboxDisabled) {
            rowsInput.value = '';
            columnsInput.value = '';
        }
    };
    syncGridInputs();
    hasSpacesCheckbox.addEventListener('change', syncGridInputs);
}

/** A custom onClear step for the edit type form to reset hidden/disabled parents. */
function editTypeClear(form) {
    genericClear(form); // Run the standard clear process first

    // Re-enable the 'has_spaces' checkbox to prevent its disabled state from leaking.
    const hasSpacesCheckbox = form.querySelector('[name="has_spaces"]');
    if (hasSpacesCheckbox) {
        hasSpacesCheckbox.disabled = false;
    }

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

// --- Location Protocols ---

/** A custom onClear step for the Add Child form that avoids a full reset. */
function addChildClear(form) {
    clearFormErrors(form);
    // Manually clear only the fields that the user interacts with,
    // leaving the parent_name field alone so it can be populated.
    form.querySelector('[name="name"]').value = '';
    const locationTypeSelect = form.querySelector('[name="location_type"]');
    if (locationTypeSelect) {
        locationTypeSelect.innerHTML = ''; // Clear old options
    }
}

/**
 * Populates the 'Add Child Location' form, including the grid and dropdown.
 */
async function addChildPopulate(form, data) {
    // 1. Verify that the necessary data is present.
    if (!data.parentId || !data.parentName) {
        console.error("Add Child Modal: Missing parentId or parentName from the trigger button.", data);
        return;
    }

    // 2. Populate the static and hidden fields in the form.
    form.action = `/location_configuration/locations/add-child/`;
    form.querySelector('[name="parent"]').value = data.parentId;
    form.querySelector('[name="parent_name"]').value = data.parentName;

    const select = form.querySelector('select[name="location_type"]');
    if (!select) {
        console.error("Add Child Modal: Could not find the location_type select element in the form.");
        return;
    }

    try {
        // 3. Populate the location grid and the dropdown concurrently.
        await Promise.all([
            populateLocationGrid(form, data.parentId),
            (async () => {
                const response = await fetch(`/location_configuration/get-child-types/${data.parentId}/`);
                if (!response.ok) {
                    console.error("Failed to fetch child types. Server responded with status:", response.status);
                    return;
                }
                const childTypes = await response.json();

                // 4. Build the dropdown options.
                select.innerHTML = ''; // Clear existing options
                const placeholder = document.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Select a location type';
                select.appendChild(placeholder);

                childTypes.forEach(type => {
                    const option = document.createElement('option');
                    option.value = type.id;
                    option.textContent = type.name;
                    select.appendChild(option);
                });
            })()
        ]);

    } catch (error) {
        console.error("An error occurred while populating the add child modal:", error);
    }
}

/** A custom onClear step for the edit location form. */
function editLocationClear(form) {
    genericClear(form); // Run the standard clear process first.

    // Ensure the parent_name container is visible again when the form is cleared.
    const parentNameContainer = form.querySelector('[name="parent_name"]')?.closest('.form-field');
    if (parentNameContainer) {
        parentNameContainer.style.display = '';
    }
}

/** Populates the 'Edit Location' form with data fetched from the server. */
async function editLocationPopulate(form, data) {
    form.action = `/location_configuration/locations/edit/${data.locationId}/`;
    const response = await fetch(`/location_configuration/get-location-details/${data.locationId}/`);
    const details = await response.json();
    form.dataset.hasChildren = details.has_children;
    form.querySelector('[name="name"]').value = details.name;

    const parentInput = form.querySelector('[name="parent"]');
    if (parentInput) {
        parentInput.value = details.parent_id || '';
    }

    const parentNameField = form.querySelector('[name="parent_name"]');
    const parentNameContainer = parentNameField ? parentNameField.closest('.form-field') : null;

    if (parentNameContainer) {
        if (details.parent_name) {
            parentNameContainer.style.display = '';
            parentNameField.value = details.parent_name;
        } else {
            parentNameContainer.style.display = 'none';
        }
    }

    const spaceInfoField = form.querySelector('[name="space_info"]');
    const spaceInfoContainer = spaceInfoField ? spaceInfoField.closest('.form-field') : null;

    if (spaceInfoContainer) {
        if (details.space_info) {
            spaceInfoContainer.style.display = '';
            spaceInfoField.value = details.space_info;
        } else {
            spaceInfoContainer.style.display = 'none';
        }
    }

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

/**
 * Attaches event listeners to all location tree toggle buttons.
 */
const initLocationTreeCollapse = () => {
    document.querySelectorAll('.location-node-toggle').forEach(button => {
        button.addEventListener('click', handleLocationNodeToggle);
    });
};

/**
 * Attaches event listeners to the main tree control buttons.
 */
const initTreeControlButtons = () => {
    const expandBtn = document.getElementById('expand-all-btn');
    const collapseBtn = document.getElementById('collapse-all-btn');

    if (expandBtn) expandBtn.addEventListener('click', expandAllNodes);
    if (collapseBtn) collapseBtn.addEventListener('click', collapseAllNodes);
};

/** The main entry point for the script, executed after the DOM is loaded. */
document.addEventListener("DOMContentLoaded", () => {
    initIconPickers();
    initEventListeners();
    initLocationTreeCollapse();
    initTreeControlButtons();
    restoreTreeState();
});