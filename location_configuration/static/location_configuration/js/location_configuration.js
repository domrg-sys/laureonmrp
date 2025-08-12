// --- Global variables to hold the icon picker instances ---
let addIconPickerInstance = null;
let editIconPickerInstance = null;


// --- Main Entry Point ---
document.addEventListener("DOMContentLoaded", () => {
    initializeIconPickers();
    initializeLocationConfigModals();
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
 * Sets up all page-specific modal behaviors, including form clearing and populating.
 */
function initializeLocationConfigModals() {
    const addModal = document.querySelector('#add-type-modal');
    const editModal = document.querySelector('#edit-type-modal');

    // --- Behavior for the "Add" Modal ---
    // The main.js script now handles the click and opening of the modal.
    // If the modal is opened, the form is cleared.
    if (addModal) {
        // Listen for the 'is-active' class change.
        const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                if (mutation.attributeName === 'class' && addModal.classList.contains('is-active')) {
                    const form = addModal.querySelector('form');
                    if (form && window.uiUtils) {
                        window.uiUtils.clearForm(form);
                    }
                    if (addIconPickerInstance) {
                        addIconPickerInstance.setChoiceByValue('warehouse'); 
                    }
                    handleConditionalGridFields(addModal);
                }
            });
        });
        observer.observe(addModal, { attributes: true });
    }

    // --- Behavior for the "Edit" Modal ---
    // The generic modal handler in main.js will open the modal.
    // Piggyback on the same click event that main.js is listening for.
    document.addEventListener('click', function(event) {
        // Find the button that was clicked, if it was an edit button
        const editButton = event.target.closest('.edit-type-btn');
        if (!editButton) return;

        // If an edit button was clicked, populate the form.
        const form = editModal.querySelector('form');
        populateEditForm(form, editButton.dataset.actionInfo);
    });


    // --- Run conditional logic on page load for BOTH modals ---
    // This ensures fields are correctly disabled if a form is re-rendered with errors.
    if (addModal) {
      handleConditionalGridFields(addModal);
    }
    if (editModal) {
      handleConditionalGridFields(editModal);
    }
}

// --- Logic Functions ---

/**
 * Populates the edit form with data from the clicked table row.
 * @param {HTMLFormElement} form The form element inside the edit modal.
 * @param {string} jsonData The JSON string of data from the button's data-attribute.
 */
function populateEditForm(form, jsonData) {
    if (!form || !jsonData) return;

    if (window.uiUtils) {
        window.uiUtils.clearForm(form);
    }
    
    const data = JSON.parse(jsonData);

    // --- Handle Parent Checkboxes ---
    // First, reset all checkboxes to be visible. This is crucial when opening the modal for different items consecutively.
    const allParentCheckboxes = form.querySelectorAll('.checkbox-list label');
    allParentCheckboxes.forEach(label => {
        label.style.display = ''; // Use an empty string to reset to default CSS display
    });

    // Now, hide the labels for invalid parent IDs.
    if (data.invalid_parent_ids) {
        data.invalid_parent_ids.forEach(parentId => {
            const checkbox = form.querySelector(`input[name="allowed_parents"][value="${parentId}"]`);
            if (checkbox) {
                const label = checkbox.closest('label');
                if (label) {
                    label.style.display = 'none';
                }
            }
        });
    }

    // --- Populate Standard Fields ---
    form.querySelector('input[name="location_type_id"]').value = data.location_type_id;
    form.querySelector('input[name="name"]').value = data.name;
    form.querySelector('input[name="rows"]').value = data.rows || '';
    form.querySelector('input[name="columns"]').value = data.columns || '';

    // Set the icon picker's value
    if (editIconPickerInstance) {
        editIconPickerInstance.setChoiceByValue(data.icon || 'warehouse');
    }
    
    // Check the correct parent checkboxes from the allowed list
    if (data.allowed_parents) {
        data.allowed_parents.forEach(parentId => {
            const checkbox = form.querySelector(`input[name="allowed_parents"][value="${parentId}"]`);
            if (checkbox) checkbox.checked = true;
        });
    }

    // Set boolean checkboxes
    form.querySelector('input[name="can_store_inventory"]').checked = data.can_store_inventory;
    form.querySelector('input[name="can_store_samples"]').checked = data.can_store_samples;
    form.querySelector('input[name="has_spaces"]').checked = data.has_spaces;

    // Conditionally disable fields if the type is already in use
    if (data['is-in-use']) {
        form.querySelector('input[name="name"]').disabled = true;
        form.querySelector('input[name="has_spaces"]').disabled = true;
    }

    // Now that the modal is populated, run the conditional logic for its grid fields.
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
        rowsInput.disabled = !isChecked;
        colsInput.disabled = !isChecked;
        if (!isChecked) {
            rowsInput.value = '';
            colsInput.value = '';
        }
    };

    // Run once on setup and then add a listener for changes.
    toggleGridInputs();
    hasSpacesCheckbox.removeEventListener('change', toggleGridInputs); // Prevent duplicate listeners
    hasSpacesCheckbox.addEventListener('change', toggleGridInputs);
}