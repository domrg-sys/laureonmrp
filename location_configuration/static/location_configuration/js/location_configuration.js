// --- Global variables to hold the icon picker instances ---
let addIconPickerInstance = null;
let editIconPickerInstance = null;


// --- Main Entry Point ---
document.addEventListener("DOMContentLoaded", () => {
    initializeIconPickers();
    setupEventListeners();
    initializeModalsOnLoad();
});


// --- Initialization Functions ---

/**
 * Initializes the Choices.js icon picker for both the 'add' and 'edit' modals.
 * This code is specific to this page because it knows the exact modal IDs.
 */
function initializeIconPickers() {
    const initChoices = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        return new Choices(element, {
            searchEnabled: false,
            itemSelectText: '',
            callbackOnCreateTemplates: function (template) {
                return {
                    item: ({ classNames }, data) => {
                        return template(`
                            <div class="${classNames.item}" data-item data-id="${data.id}" data-value="${data.value}">
                                <span class="material-symbols-outlined">${data.value}</span>
                            </div>
                        `);
                    },
                    choice: ({ classNames }, data) => {
                         return template(`
                            <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : ''}" data-select-text="" data-choice data-id="${data.id}" data-value="${data.value}" role="option">
                                <span class="material-symbols-outlined">${data.value}</span>
                            </div>
                        `);
                    },
                };
            },
        });
    };

    // Initialize one picker for each modal and store its instance globally.
    addIconPickerInstance = initChoices('#add-type-modal .js-choice-icon-picker');
    editIconPickerInstance = initChoices('#edit-type-modal .js-choice-icon-picker');
}

/**
 * Sets up a single, delegated event listener to handle all clicks.
 */
function setupEventListeners() {
    document.body.addEventListener('click', function(event) {
        const target = event.target;
        const addTypeButton = target.closest('button[data-modal-target="#add-type-modal"]');
        const editTypeButton = target.closest('.edit-type-btn');
        const addChildButton = target.closest('.add-child-btn');
        const addLocationButton = target.closest('button[data-modal-target="#add-location-modal"]');
        const editLocationButton = target.closest('.edit-location-btn');

        if (addTypeButton) {
            handleAddType(addTypeButton);
        } else if (editTypeButton) {
            handleEditType(editTypeButton);
        } else if (addChildButton) {
            handleAddChild(addChildButton);
        } else if (addLocationButton) {
            handleAddLocation(addLocationButton);
        } else if (editLocationButton) {
            handleEditLocation(editLocationButton);
        }
    });

    // Add listeners for dynamic fields within modals
    const addModal = document.querySelector('#add-type-modal');
    if (addModal) {
        handleConditionalGridFields(addModal);
    }

    const editModal = document.querySelector('#edit-type-modal');
    if (editModal) {
        handleConditionalGridFields(editModal);
    }
}


/**
 * If any modals are rendered with server-side errors, they will have the
 * `data-is-open-on-load` attribute. This function ensures they are visible
 * when the page loads.
 */
function initializeModalsOnLoad() {
    document.querySelectorAll('.modal-overlay[data-is-open-on-load]').forEach(modal => {
        if (modal.id === 'add-type-modal' || modal.id === 'edit-type-modal') {
             handleConditionalGridFields(modal);
        }
    });
}


// --- Event Handler Functions ---

function handleAddType(button) {
    const modal = document.querySelector(button.dataset.modalTarget);
    if (!modal) return;

    const form = modal.querySelector('form');
    if (form && window.uiUtils) {
        window.uiUtils.clearForm(form);
    }
    if (addIconPickerInstance) {
        addIconPickerInstance.setChoiceByValue('warehouse');
    }
    handleConditionalGridFields(modal);
}

function handleEditType(button) {
    const modal = document.querySelector(button.dataset.modalTarget);
    if (!modal) return;

    const form = modal.querySelector('form');
    populateEditForm(form, button.dataset.actionInfo);
}

async function handleAddChild(button) {
    const parentId = button.dataset.parentId;
    const parentName = button.dataset.parentName;
    const modal = document.querySelector(button.dataset.modalTarget);
    
    if (!modal) return;

    const selectElement = modal.querySelector('select[name="location_type"]');
    const form = modal.querySelector('#add-child-location-form');

    if (!selectElement || !form) return;

    modal.querySelector('#parent-location-name-title').textContent = parentName;
    modal.querySelector('#parent-location-id').value = parentId;
    modal.querySelector('#parent-location-name-display').value = parentName;

    try {
        const response = await fetch(`/location_configuration/get-child-types/${parentId}/`);
        if (!response.ok) throw new Error('Network response was not ok');
        const childTypes = await response.json();
        
        selectElement.innerHTML = '';
        const defaultOption = new Option('Select a location type', '');
        selectElement.add(defaultOption);

        childTypes.forEach(type => {
            const option = new Option(type.name, type.id);
            selectElement.add(option);
        });
    } catch (error) {
        console.error('Failed to fetch child location types:', error);
        selectElement.innerHTML = '<option>Could not load types</option>';
    }
}

function handleAddLocation(button) {
    const modal = document.querySelector(button.dataset.modalTarget);
    if (!modal) return;

    const form = modal.querySelector('form');
    if (form && window.uiUtils) {
        window.uiUtils.clearForm(form);
    }
}

async function handleEditLocation(button) {
    const locationId = button.dataset.locationId;
    const modal = document.querySelector(button.dataset.modalTarget);
    if (!modal || !locationId) return;

    const form = modal.querySelector('form');

    try {
        const response = await fetch(`/location_configuration/get-location-details/${locationId}/`);
        if (!response.ok) throw new Error('Failed to fetch location details.');
        const data = await response.json();

        // Populate the form fields
        form.querySelector('input[name="name"]').value = data.name;
        form.querySelector('input[name="location_id"]').value = locationId;

        // Populate and select the location_type dropdown
        const selectElement = form.querySelector('select[name="location_type"]');
        selectElement.innerHTML = ''; // Clear existing options
        data.valid_location_types.forEach(type => {
            const option = new Option(type.name, type.id);
            selectElement.add(option);
        });
        selectElement.value = data.current_location_type_id;

        // Disable the dropdown if the location has children.
        selectElement.disabled = data.has_children;


    } catch (error) {
        console.error("Error populating edit location form:", error);
    }
}

// --- Logic Functions ---

/**
 * Populates the 'Edit Location Type' form with data from the clicked table row.
 * @param {HTMLFormElement} form The form element inside the edit modal.
 * @param {string} jsonData The JSON string of data from the button's data-attribute.
 */
function populateEditForm(form, jsonData) {
    if (!form || !jsonData) return;

    const data = JSON.parse(jsonData);

    // First, reset all parent checkboxes to a default state (enabled and unchecked)
    form.querySelectorAll('input[name="allowed_parents"]').forEach(checkbox => {
        checkbox.disabled = false;
        checkbox.checked = false;
        const label = checkbox.closest('label');
        if (label) {
            label.style.display = ''; // Make sure label is visible
        }
    });

    // Hide checkboxes that would cause a circular dependency
    if (data.invalid_parent_ids) {
        data.invalid_parent_ids.forEach(parentId => {
            const checkbox = form.querySelector(`input[name="allowed_parents"][value="${parentId}"]`);
            if (checkbox) {
                const label = checkbox.closest('label');
                if (label) {
                    label.style.display = 'none'; // We hide these entirely
                }
            }
        });
    }

    // Check the boxes for all *currently allowed* parents from the database.
    if (data.allowed_parents) {
        data.allowed_parents.forEach(parentId => {
            const checkbox = form.querySelector(`input[name="allowed_parents"][value="${parentId}"]`);
            if (checkbox) {
                checkbox.checked = true;
            }
        });
    }

    // Separately, disable the checkboxes for parent types that are actively in use.
    // An in-use parent's checkbox should already be checked from the step above.
    if (data.in_use_parent_type_ids) {
        data.in_use_parent_type_ids.forEach(parentId => {
            const checkbox = form.querySelector(`input[name="allowed_parents"][value="${parentId}"]`);
            if (checkbox) {
                checkbox.disabled = true;
            }
        });
    }

    // Populate Standard Fields
    form.querySelector('input[name="location_type_id"]').value = data.location_type_id;
    form.querySelector('input[name="name"]').value = data.name;
    form.querySelector('input[name="rows"]').value = data.rows || '';
    form.querySelector('input[name="columns"]').value = data.columns || '';

    if (editIconPickerInstance) {
        editIconPickerInstance.setChoiceByValue(data.icon || 'warehouse');
    }

    form.querySelector('input[name="can_store_inventory"]').checked = data.can_store_inventory;
    form.querySelector('input[name="can_store_samples"]').checked = data.can_store_samples;
    form.querySelector('input[name="has_spaces"]').checked = data.has_spaces;

    if (data['is-in-use']) {
        form.querySelector('input[name="has_spaces"]').disabled = true;
        form.querySelector('input[name="rows"]').disabled = true;
        form.querySelector('input[name="columns"]').disabled = true;
    } else {
        // Explicitly re-enable fields if the type is not in use
        form.querySelector('input[name="has_spaces"]').disabled = false;
        // NOTE: We don't re-enable rows/columns here.
        // The handleConditionalGridFields function will do that correctly.
    }

    handleConditionalGridFields(form.closest('.modal-overlay'));
}

/**
 * Handles the conditional logic for enabling/disabling the grid input fields.
 * @param {HTMLElement} container The container element (e.g., a modal).
 */
function handleConditionalGridFields(container) {
    if (!container) return;
    const hasSpacesCheckbox = container.querySelector('input[name="has_spaces"]');
    const rowsInput = container.querySelector('input[name="rows"]');
    const colsInput = container.querySelector('input[name="columns"]');

    if (!hasSpacesCheckbox || !rowsInput || !colsInput) return;

    const toggleGridInputs = () => {
        const isChecked = hasSpacesCheckbox.checked;
        const isParentDisabled = hasSpacesCheckbox.disabled;

        // A field should be disabled if the box is unchecked OR if the box itself is disabled.
        rowsInput.disabled = !isChecked || isParentDisabled;
        colsInput.disabled = !isChecked || isParentDisabled;

        if (!isChecked) {
            rowsInput.value = '';
            colsInput.value = '';
        }
    };
    
    hasSpacesCheckbox.removeEventListener('change', toggleGridInputs);
    hasSpacesCheckbox.addEventListener('change', toggleGridInputs);
    toggleGridInputs();
}