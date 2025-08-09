document.addEventListener("DOMContentLoaded", () => {
    // This listener is the key fix. It waits for the "Add" button to be clicked.
    const addModalButton = document.querySelector('[data-modal-target="#add-type-modal"]');
    const addModal = document.querySelector("#add-type-modal");

    if (addModalButton && addModal) {
        addModalButton.addEventListener('click', () => {
            // The global main.js script has already cleared the form.
            // Now, we run our page-specific logic.
            
            // Reset the icon picker to its default value.
            if (iconPickerInstance) {
                iconPickerInstance.setChoiceByValue('warehouse'); 
            }

            // Set up conditional fields.
            handleConditionalGridFields(addModal);
        });
    }
  
    // Initialize conditional fields for the 'add' modal on initial page load (in case of errors).
    if (addModal) {
      handleConditionalGridFields(addModal);
    }
    
    // Set up the edit buttons to open the modal and populate it with data.
    initializeEditTypeButtons();
});

/**
 * Handles the conditional logic for enabling/disabling the grid input fields.
 * @param {HTMLElement} container The container element (e.g., a modal's form).
 */
function handleConditionalGridFields(container) {
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

    toggleGridInputs();
    hasSpacesCheckbox.addEventListener('change', toggleGridInputs);
}
/**
 * Sets up the edit buttons to open the modal and populate it with data.
 */
function initializeEditTypeButtons() {
    const editButtons = document.querySelectorAll('.edit-type-btn');
    const modal = document.querySelector('#edit-type-modal');
    if (!modal) return;

    const form = modal.querySelector('form');
    // Find the container for the parent checkboxes and get all the labels
    const parentsContainer = form.querySelector('input[name="allowed_parents"]').closest('.checkbox-list');
    if (!parentsContainer) return;
    const allParentLabels = parentsContainer.querySelectorAll('label');

    editButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();

            // The generic modal script in main.js will have already cleared the form.
            const data = JSON.parse(button.dataset.data);

            // --- Logic to dynamically hide/show parent options ---
            const idsToHide = new Set(data.descendant_ids);
            idsToHide.add(data.self_id);

            // 1. First, reset the state by showing all parent options.
            allParentLabels.forEach(label => {
                label.style.display = 'flex';
            });

            // 2. Then, hide the invalid ones (the type itself and its descendants).
            allParentLabels.forEach(label => {
                const checkbox = label.querySelector('input[type="checkbox"]');
                if (checkbox && idsToHide.has(parseInt(checkbox.value, 10))) {
                    label.style.display = 'none';
                }
            });

            // Populate form fields
            form.querySelector('input[name="location_type_id"]').value = data['location_type_id'];
            form.querySelector('input[name="name"]').value = data.name;

            // Set the icon picker's value, defaulting if necessary.
            if(editIconPickerInstance) {
                editIconPickerInstance.setChoiceByValue(data.icon || 'warehouse');
            }
            
            // Check the correct checkboxes for allowed_parents
            if (data.allowed_parents) {
                data.allowed_parents.forEach(parentId => {
                    const checkbox = form.querySelector(`input[name="allowed_parents"][value="${parentId}"]`);
                    if (checkbox) checkbox.checked = true;
                });
            }

            form.querySelector('input[name="can_store_inventory"]').checked = data.can_store_inventory;
            form.querySelector('input[name="can_store_samples"]').checked = data.can_store_samples;
            form.querySelector('input[name="has_spaces"]').checked = data.has_spaces;
            form.querySelector('input[name="rows"]').value = data.rows;
            form.querySelector('input[name="columns"]').value = data.columns;

            // Conditionally disable fields if the type is in use
            if (data['is-in-use']) {
                form.querySelector('input[name="name"]').disabled = true;
                form.querySelector('input[name="has_spaces"]').disabled = true;
            }

            // Now that the modal is populated, run the conditional logic for grid fields.
            handleConditionalGridFields(modal);
        });
    });
}