// In static/js/main.js

/**
 * Main entry point for all JavaScript on the site.
 * This single event listener ensures all functions run in a predictable order
 * after the document is fully loaded.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeModals();
  handleTabSlider();
  handleConditionalGridFields();
  initializeIconPicker();
});


// --- FUNCTION DEFINITIONS ---

/**
 * Sets up all modal open/close triggers.
 */
function initializeModals() {
  const openModal = ($el) => $el.classList.add("is-active");
  const closeModal = ($el) => $el.classList.remove("is-active");

  document.querySelectorAll("[data-modal-target]").forEach(($trigger) => {
    const modalId = $trigger.dataset.modalTarget;
    const $target = document.querySelector(modalId);
    if ($target) {
      $trigger.addEventListener("click", () => openModal($target));
    }
  });

  document.querySelectorAll(".modal-overlay").forEach(($overlay) => {
    $overlay.addEventListener("click", (event) => {
      if (event.target.classList.contains('modal-overlay') || event.target.closest('.modal-close')) {
        closeModal($overlay);
      }
    });
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
 */
function handleConditionalGridFields() {
    const hasSpacesCheckbox = document.getElementById('id_has_spaces');
    const rowsInput = document.getElementById('id_rows');
    const colsInput = document.getElementById('id_columns');

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
 * Initializes the Choices.js icon picker.
 */
function initializeIconPicker() {
    const iconPickerElement = document.querySelector('.js-choice-icon-picker');

    if (iconPickerElement) {
        const choices = new Choices(iconPickerElement, {
            placeholder: true,
            placeholderValue: 'Choose an icon...',
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