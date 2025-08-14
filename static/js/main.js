/**
 * =========================================================================
 * Main Application Script
 * -------------------------------------------------------------------------
 * This script follows a simple, two-protocol architecture:
 * 1. `initProtocol`: Runs a list of initializers once when the page loads.
 * 2. `formProtocol`: Prepares a form each time a user interacts with it.
 *
 * The file is structured from most generic to most specific:
 * - Protocols
 * - Global UI Utilities
 * - Event Handlers (the specific actions)
 * - Initializers (the one-time setup functions)
 * - Main Execution Block (kicks everything off)
 * =========================================================================
 */


// =========================================================================
// === 1. PROTOCOLS
// =========================================================================

/** Executes a list of one-time setup functions. */
function initProtocol(initializers) {
  initializers.forEach(init => init());
}

/** Prepares a form for display based on a configuration. */
function formProtocol({ form, data = null, onClear, onPopulate, onConfigure }) {
  if (!form) return console.error("Form Protocol: A 'form' element must be provided.");
  if (onClear) onClear(form, data);
  if (onPopulate && data) onPopulate(form, data);
  if (onConfigure) onConfigure(form, data);
}


// =========================================================================
// === 2. UI UTILITIES
// =========================================================================

window.uiUtils = {
  /** Clears only the user-enterable fields in a form. */
  clearFormFields: (form) => {
    if (!form) return;
    for (const field of form.elements) {
      const type = field.type.toLowerCase();
      if (['submit', 'button', 'reset', 'hidden'].includes(type)) continue;

      if (type === 'checkbox' || type === 'radio') {
        field.checked = false;
      } else {
        field.value = '';
      }
    }
  },

  /** Clears only the validation error messages and styles from a form. */
  clearFormErrors: (form) => {
    if (!form) return;
    form.querySelector('.form-error-summary')?.remove();
    form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
  }
};


// =========================================================================
// === 3. EVENT HANDLERS
// =========================================================================

/** Handles closing a modal when its dark overlay is clicked. */
function handleModalOverlayClick(event) {
  // Only close if the click is on the overlay itself, not a child element.
  if (event.target === this) {
    this.classList.remove('is-active');
  }
}

/** Handles closing a modal when a ".modal-close" button is clicked. */
function handleModalCloseClick(event) {
  this.closest('.modal-overlay')?.classList.remove('is-active');
}

/** Prepares and opens the delete confirmation modal. */
function handlePrepareDeleteModal(event) {
  event.preventDefault();
  const deleteModal = document.querySelector('#delete-confirmation-modal');
  const dataStr = this.dataset.actionInfo;

  if (!deleteModal || !dataStr) return;

  try {
    const data = JSON.parse(dataStr);
    const form = deleteModal.querySelector('form');
    form.action = `/core/delete/${data.app_label}/${data.model_name}/${data.pk}/`;
    deleteModal.querySelector('#delete-success-url').value = data.success_url;
    deleteModal.querySelector('#delete-item-name').textContent = data.item_name || 'this item';
    deleteModal.classList.add('is-active');
  } catch (e) {
    console.error("Failed to parse delete data:", e);
  }
}


// =========================================================================
// === 4. INITIALIZERS (Strategies for the `initProtocol`)
// =========================================================================

/** Sets up the standard modal closing behaviors. */
const initGenericModalClosers = () => {
  document.querySelectorAll(".modal-overlay").forEach(modal => {
    modal.addEventListener("click", handleModalOverlayClick);
  });
  document.querySelectorAll(".modal-close").forEach(button => {
    button.addEventListener("click", handleModalCloseClick);
  });
};

/** Finds all delete buttons and attaches their specific handler. */
const initDeleteConfirmationTriggers = () => {
  const deleteButtons = document.querySelectorAll('button[data-modal-target="#delete-confirmation-modal"]');
  deleteButtons.forEach(button => {
    button.addEventListener('click', handlePrepareDeleteModal);
  });
};

/** Manages the animated slider for tab navigation. */
const initTabSlider = () => {
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
};

/** Opens any modals that are flagged to be open on page load (due to form errors). */
const initModalsOnLoad = () => {
  document.querySelectorAll('.modal-overlay[data-is-open-on-load]').forEach(modal => {
    modal.classList.add('is-active');
  });
};


// =========================================================================
// === 5. MAIN EXECUTION
// =========================================================================

document.addEventListener("DOMContentLoaded", () => {
  // Run the Initialization Protocol with all site-wide setup functions.
  initProtocol([
    initGenericModalClosers,
    initDeleteConfirmationTriggers,
    initTabSlider,
    initModalsOnLoad
  ]);
});