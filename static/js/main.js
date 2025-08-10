/**
 * main.js
 *
 * Generic, site-wide UI infrastructure. This file sets up basic behaviors
 * for common UI patterns like modals and tab sliders based on data-attributes
 * and standard class names. It is not specific to any single app.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeModalToggles();
  handleTabSlider();
});


/**
 * Sets up generic open/close triggers for all modals on the site.
 * - It finds any element with a `data-modal-target` attribute and makes it open a modal.
 * - It finds any element with a `.modal-close` class or `.modal-overlay` and makes it close the modal.
 */
function initializeModalToggles() {
  // Function to open a modal
  const openModal = ($el) => {
    if ($el) $el.classList.add("is-active");
  };

  // Function to close a modal
  const closeModal = ($el) => {
    if ($el) $el.classList.remove("is-active");
  };

  // Find all buttons that are meant to open a modal
  document.querySelectorAll("[data-modal-target]").forEach(($trigger) => {
    const modalId = $trigger.dataset.modalTarget;
    const $target = document.querySelector(modalId);
    if ($target) {
      $trigger.addEventListener("click", () => {
        openModal($target);
      });
    }
  });

  // Handle closing by clicking the background overlay
  document.querySelectorAll(".modal-overlay").forEach(($overlay) => {
    $overlay.addEventListener("click", (event) => {
      // Only close if the overlay itself was clicked, not its children
      if (event.target === $overlay) {
        closeModal($overlay);
      }
    });
  });

  // Handle closing by clicking the dedicated 'X' button
  document.querySelectorAll(".modal-close").forEach(($closeButton) => {
    const $modal = $closeButton.closest('.modal-overlay');
    if ($modal) {
        $closeButton.addEventListener("click", () => {
            closeModal($modal);
        });
    }
  });

  // Handle modals that need to be open on page load (due to form errors)
  document.querySelectorAll('.modal-overlay[data-is-open-on-load]').forEach(modal => {
      openModal(modal);
  });
}

/**
 * Manages the animated slider for tab navigation.
 * This function is already generic and requires no changes.
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
 * We are attaching it to the global 'window' object so that other,
 * more specific scripts can access and use it when needed.
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
        field.selectedIndex = -1; // Works for standard selects
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