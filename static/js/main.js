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
  
  // Initialize conditional fields for the 'add' modal.
  const addModal = document.querySelector('#add-type-modal');
  if (addModal) {
    handleConditionalGridFields(addModal);
  }
  
  // Set up the edit buttons to open the modal and populate it with data.
  initializeEditTypeButtons();
});


// --- FUNCTION DEFINITIONS ---

/**
 * A custom function to manually clear all fields in a form.
 * This is more robust than form.reset() for our use case.
 * @param {HTMLFormElement} form The form element to clear.
 */
const clearForm = (form) => {
  const elements = form.elements;

  for (let i = 0; i < elements.length; i++) {
    const field = elements[i];
    const type = field.type.toLowerCase();
    const tagName = field.tagName.toLowerCase();

    // Skip fields that shouldn't be cleared automatically
    if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'file') {
      continue;
    }

    if (type === 'checkbox' || type === 'radio') {
      field.checked = false;
    } else if (tagName === 'select' && !field.classList.contains('js-choice-icon-picker')) {
      field.selectedIndex = -1; 
    } else {
      field.value = '';
    }
  }

  // Remove any existing error messages
  const errorSummary = form.querySelector('.form-error-summary');
  if (errorSummary) errorSummary.remove();
  form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
  form.querySelectorAll('input, select').forEach(el => el.disabled = false);

  // Specifically reset the Choices.js instances if they exist
  if (form.closest('#add-type-modal') && iconPickerInstance) {
    iconPickerInstance.setChoiceByValue('warehouse'); 
  }
  if (form.closest('#edit-type-modal') && editIconPickerInstance) {
    editIconPickerInstance.setChoiceByValue('warehouse'); 
  }
};

/**
 * Sets up all modal open/close triggers and handles form resetting.
 */
function initializeModals() {
  const openModal = ($el) => {
    $el.classList.add("is-active");
  };

  const closeModal = ($el) => {
    $el.classList.remove("is-active");
  };

  // Setup triggers to open modals on click (for non-edit buttons)
  document.querySelectorAll("[data-modal-target]").forEach(($trigger) => {
    const modalId = $trigger.dataset.modalTarget;
    const $target = document.querySelector(modalId);
    if ($target) {
      $trigger.addEventListener("click", () => {
        const form = $target.querySelector('form');
        if (form) clearForm(form);
        openModal($target);
      });
    }
  });

  // Setup triggers to close modals.
  document.querySelectorAll(".modal-overlay").forEach(($overlay) => {
    $overlay.addEventListener("click", (event) => {
      if (event.target.classList.contains('modal-overlay') || event.target.closest('.modal-close')) {
        closeModal($overlay);
      }
    });

    // Check on page load if a modal should be open due to form errors.
    if ($overlay.hasAttribute('data-is-open-on-load')) {
        openModal($overlay);
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
 * Initializes the Choices.js icon picker and stores its instance.
 */
function initializeIconPicker() {
    const initChoices = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        return new Choices(element, {
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
    };

    iconPickerInstance = initChoices('#add-type-modal .js-choice-icon-picker');
    editIconPickerInstance = initChoices('#edit-type-modal .js-choice-icon-picker');
}

/**
 * Sets up the edit buttons to open the modal and populate it with data.
 */
function initializeEditTypeButtons() {
    const editButtons = document.querySelectorAll('.edit-type-btn');
    const modal = document.querySelector('#edit-type-modal');
    if (!modal) return;

    const form = modal.querySelector('form');

    editButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            event.preventDefault();
            clearForm(form); 

            const data = JSON.parse(button.dataset.data);

            // Populate form fields
            form.querySelector('input[name="location_type_id"]').value = data['location_type_id'];
            form.querySelector('input[name="name"]').value = data.name;
            if(editIconPickerInstance) editIconPickerInstance.setChoiceByValue(data.icon);

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

            modal.classList.add('is-active');
        });
    });
}