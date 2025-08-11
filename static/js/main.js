/**
 * Generic, site-wide UI infrastructure. This file sets up basic behaviors
 * for common UI patterns like modals and tab sliders based on data-attributes
 * and standard class names. It is not specific to any single app.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeModalSystem();
  handleTabSlider();
});

/**
 * A single, unified function to handle all modal logic, including the 
 * special case for the delete confirmation pop-up.
 */
function initializeModalSystem() {
  // Helper functions
  const openModal = ($el) => {
    if ($el) $el.classList.add("is-active");
  };

  const closeModal = ($el) => {
    if ($el) $el.classList.remove("is-active");
  };

  // --- Initialize All Modal Triggers ---
  document.querySelectorAll('[data-modal-target]').forEach(($trigger) => {
    const modalId = $trigger.dataset.modalTarget;
    const $targetModal = document.querySelector(modalId);

    if ($targetModal) {
      $trigger.addEventListener('click', (event) => {
        // This is the most important part: prevent the default link behavior
        event.preventDefault();

        // --- Handle the special case for the delete modal ---
        if (modalId === '#delete-confirmation-modal') {
          const dataStr = $trigger.dataset.actionInfo;
          if (dataStr) {
            try {
              const data = JSON.parse(dataStr);
              const form = $targetModal.querySelector('form');
              const itemNameSpan = $targetModal.querySelector('#delete-item-name');
              const successUrlInput = $targetModal.querySelector('#delete-success-url');

              // Populate the modal form with data from the button
              if (form) form.setAttribute('action', `/core/delete/${data.app_label}/${data.model_name}/${data.pk}/`);
              if (successUrlInput) successUrlInput.value = data.success_url;
              if (itemNameSpan) itemNameSpan.textContent = data.item_name || 'this item';
            } catch (e) {
              console.error("Failed to parse delete data:", e);
              return; // Exit if data is invalid
            }
          }
        }

        // Open the target modal. For delete, it's now populated; for others, it's empty.
        openModal($targetModal);
      });
    }
  });

  // --- Handle Closing Modals ---
  document.querySelectorAll(".modal-overlay").forEach(($overlay) => {
    $overlay.addEventListener("click", (event) => {
      if (event.target === $overlay) {
        closeModal($overlay);
      }
    });
  });

  document.querySelectorAll(".modal-close").forEach(($closeButton) => {
    const $modal = $closeButton.closest('.modal-overlay');
    if ($modal) {
        $closeButton.addEventListener("click", () => {
            closeModal($modal);
        });
    }
  });
  
  // --- Handle Modals That Open on Page Load ---
  document.querySelectorAll('.modal-overlay[data-is-open-on-load]').forEach(modal => {
      openModal(modal);
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
 * A robust utility function to clear all fields in a form.
 * This is being attached to the global 'window' object so that other,
 * more specific scripts (like location_configuration.js) can use it.
 */
window.uiUtils = {
  clearForm: (form) => {
    if (!form) return;
    const elements = form.elements;

    for (let i = 0; i < elements.length; i++) {
      const field = elements[i];
      const type = field.type.toLowerCase();
      const tagName = field.tagName.toLowerCase();

      if (type === 'hidden' || type === 'submit' || type === 'button' || type === 'reset' || type === 'file') {
        continue;
      }

      if (type === 'checkbox' || type === 'radio') {
        field.checked = false;
      } else if (tagName === 'select') {
        field.selectedIndex = -1; 
      } else {
        field.value = '';
      }
    }

    // Remove any existing error messages from a previous submission
    const errorSummary = form.querySelector('.form-error-summary');
    if (errorSummary) errorSummary.remove();
    form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
    form.querySelectorAll('input, select').forEach(el => el.disabled = false);
  }
};