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
 * Initializes the Tom Select icon picker with a grid layout.
 * This is the corrected and final version.
 */
function initializeIconPicker() {
    const iconPicker = document.getElementById('icon-picker');
    if (!iconPicker) return;

    if (typeof TomSelect === 'undefined') {
        console.error('Tom Select library failed to load.');
        return;
    }

    new TomSelect(iconPicker, {
        plugins: ['grid_view'],

        render: {
            option: function(data, escape) {
                return `<div class="grid-item"><span class="material-symbols-outlined">${escape(data.value)}</span></div>`;
            },
            item: function(data, escape) {
                if (!data.value) {
                    return `<div>${escape(data.text)}</div>`;
                }
                return `<div class="select-item"><span class="material-symbols-outlined">${escape(data.value)}</span></div>`;
            }
        }
    });
}