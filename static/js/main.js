/**
 * A variable to hold the Choices.js instance for our icon picker.
 * This makes it accessible to other functions that need to interact with it.
 */
let iconPickerInstance = null;
let editIconPickerInstance = null;

/**
 * Main entry point for all JavaScript on the site.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeIconPicker(); // Initialize the picker first so the instance is ready.
  initializeModals();
  handleTabSlider();
  // We now target the specific 'add' modal for the initial setup.
  const addModal = document.querySelector('#add-type-modal');
  if (addModal) {
    handleConditionalGridFields(addModal);
  }
  
  // Initialize the generic edit modal for location types
  initializeEditModal('.edit-type-btn', '#edit-type-modal', (form, data) => {
    // This is a callback function to handle logic specific to the location type edit modal
    
    // Set the hidden location_type_id field
    const typeIdField = form.querySelector('input[name="location_type_id"]');
    if (typeIdField) {
        typeIdField.value = data['type-id'];
    }

    // Handle the icon picker
    if (editIconPickerInstance) {
        editIconPickerInstance.setChoiceByValue(data['type-icon']);
    }
    
    // Handle conditional fields
    handleConditionalGridFields(form);
  });
});


// --- FUNCTION DEFINITIONS ---

/**
 * A custom function to manually clear all fields in a form.
 * This replaces form.reset() to avoid resetting to server-rendered error values.
 * @param {HTMLFormElement} form The form element to clear.
 */
const clearForm = (form) => {
  const elements = form.elements;

  // Loop through all form elements
  for (let i = 0; i < elements.length; i++) {
    const field = elements[i];
    const type = field.type.toLowerCase();
    const tagName = field.tagName.toLowerCase();

    // Skip hidden fields (like CSRF token), buttons, and file inputs
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'file') {
      continue;
    }

    // Clear text inputs, textareas, and other text-like fields
    if (tagName === 'textarea' || (tagName === 'input' && ['text', 'number', 'password', 'email', 'url', 'tel'].includes(type))) {
      field.value = '';
    }
    // Uncheck checkboxes and radio buttons
    else if (type === 'checkbox' || type === 'radio') {
      field.checked = false;
    }
    // Reset select fields that are NOT the custom icon picker
    else if (tagName === 'select' && !field.classList.contains('js-choice-icon-picker')) {
      field.selectedIndex = -1; // Or 0 to select the first option
    }
  }

    // Remove the form error summary element
    const errorSummary = form.querySelector('.form-error-summary');
    if (errorSummary) {
        errorSummary.remove();
    }

    // Remove the .has-error class from all form fields
    const errorFields = form.querySelectorAll('.has-error');
    errorFields.forEach((field) => {
        field.classList.remove('has-error');
    });


  // Finally, specifically reset the Choices.js icon picker instance
  if (iconPickerInstance) {
    iconPickerInstance.setChoiceByValue('warehouse');
  }

  if (editIconPickerInstance) {
    editIconPickerInstance.setChoiceByValue('warehouse');
  }
};

/**
 * Sets up all modal open/close triggers and handles form resetting.
 */
function initializeModals() {
  const openModal = ($el) => {
    // This function is only called on a manual click, so we should always clear the form.
    const form = $el.querySelector('form');
    if (form) {
        clearForm(form);
    }
    // Finally, show the modal.
    $el.classList.add("is-active");
  };

  const closeModal = ($el) => {
    $el.classList.remove("is-active");
    const form = $el.querySelector('form');
    if (form) {
        clearForm(form);
    }
  };

  // Setup triggers to open modals on click.
  document.querySelectorAll("[data-modal-target]").forEach(($trigger) => {
    const modalId = $trigger.dataset.modalTarget;
    const $target = document.querySelector(modalId);
    if ($target) {
      $trigger.addEventListener("click", () => openModal($target));
    }
  });

  // Setup triggers to close modals and handle initial open state.
  document.querySelectorAll(".modal-overlay").forEach(($overlay) => {
    $overlay.addEventListener("click", (event) => {
      if (event.target.classList.contains('modal-overlay') || event.target.closest('.modal-close')) {
        closeModal($overlay);
      }
    });

    // Check on page load if a modal should be open (e.g., due to form errors).
    // This happens outside the click-based openModal function.
    if ($overlay.hasAttribute('data-is-open-on-load')) {
        $overlay.classList.add('is-active');
    }
  });
}


/**
 * Manages the animated slider for tab navigation.
 */
function handleTabSlider() {
    const nav = document.querySelector('.tab-nav');
    if (!nav) return;

    const slider = nav.querySelector('.tab-nav-slider');
    const activeTab = nav.querySelector('.tab-nav-item.is-active');

    if (!slider || !activeTab) return;

    const moveSlider = () => {
        slider.style.width = `${activeTab.offsetWidth}px`;
        slider.style.left = `${activeTab.offsetLeft}px`;
    };

    moveSlider();
    window.addEventListener('resize', moveSlider);
}


/**
 * Handles the conditional logic for enabling/disabling the grid input fields.
 * This is now more generic and works on any container element passed to it.
 * @param {HTMLElement} container The container element (e.g., a modal).
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
 * Initializes the Choices.js icon picker and stores its instance.
 */
function initializeIconPicker() {
    const iconPickerElement = document.querySelector('#add-type-modal .js-choice-icon-picker');

    if (iconPickerElement) {
        // Create the Choices instance and store it in our global variable.
        iconPickerInstance = new Choices(iconPickerElement, {
            searchEnabled: false,
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
                            <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : ''} ${data.highlighted ? classNames.highlightedState : ''}" data-select-text="" data-choice data-id="${data.id}" data-value="${data.value}" role="option">
                                <span class="material-symbols-outlined">${data.value}</span>
                            </div>
                        `);
                    },
                };
            },
        });
    }

    const editIconPickerElement = document.querySelector('#edit-type-modal .js-choice-icon-picker');

    if (editIconPickerElement) {
        // Create the Choices instance and store it in our global variable.
        editIconPickerInstance = new Choices(editIconPickerElement, {
            searchEnabled: false,
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
                            <div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : ''} ${data.highlighted ? classNames.highlightedState : ''}" data-select-text="" data-choice data-id="${data.id}" data-value="${data.value}" role="option">
                                <span class="material-symbols-outlined">${data.value}</span>
                            </div>
                        `);
                    },
                };
            },
        });
    }
}

/**
 * Initializes edit modals.
 * @param {string} buttonSelector - The selector for the edit buttons.
 * @param {string} modalSelector - The selector for the modal.
 * @param {function} callback - A callback function to run after populating the form.
 */
function initializeEditModal(buttonSelector, modalSelector, callback) {
    const editButtons = document.querySelectorAll(buttonSelector);
    const modal = document.querySelector(modalSelector);

    if (!modal || editButtons.length === 0) {
        return;
    }

    const form = modal.querySelector('form');

    editButtons.forEach(button => {
        button.addEventListener('click', () => {
            const data = JSON.parse(button.dataset.data);

            // Populate form fields based on data attributes
            for (const key in data) {
                const field = form.querySelector(`[name="${key}"]`);
                if (field) {
                    if (field.type === 'checkbox') {
                        field.checked = data[key];
                    } else if (Array.isArray(data[key])) { // For multi-select fields like allowed_parents
                        data[key].forEach(value => {
                            const option = form.querySelector(`input[name="${key}"][value="${value}"]`);
                            if (option) {
                                option.checked = true;
                            }
                        });
                    }
                    else {
                        field.value = data[key];
                    }
                }
            }

            // Run the callback for modal-specific logic
            if (callback) {
                callback(form, data);
            }

            modal.classList.add('is-active');
        });
    });
}