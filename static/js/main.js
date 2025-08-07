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
 */
function initializeIconPicker() {
    const iconPicker = document.getElementById('icon-picker');
    if (!iconPicker || typeof TomSelect === 'undefined') {
        return;
    }
    if (iconPicker.tomselect) {
        return;
    }

    new TomSelect(iconPicker, {
        create: false, // Prevents typing new entries

        // **The Fix**: This function runs every time the selection changes.
        onChange: function() {
            // We wait 1 millisecond for the library to finish its faulty render.
            setTimeout(() => {
                // Then, we find and remove the leftover placeholder.
                const placeholder = this.control.querySelector('div:not(.item)');
                if (placeholder) {
                    placeholder.remove();
                }
            }, 1);
        },

        render: {
            // Renders the icon grid in the dropdown
            option: function(data, escape) {
                if (!data.value) { return '<div></div>'; }
                return `<div class="option" title="${escape(data.text)}">
                          <span class="material-symbols-outlined">${escape(data.value)}</span>
                        </div>`;
            },
            // Renders the selected item OR the placeholder in the control box
            item: function(data, escape) {
                if (!data.value) {
                    return `<div>${escape(data.text)}</div>`;
                }
                return `<div class="item">
                          <span class="material-symbols-outlined">${escape(data.value)}</span>
                        </div>`;
            }
        }
    });
}