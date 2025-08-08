/**
 * Main entry point for all JavaScript on the site.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeModals();
  handleTabSlider();
});


// --- FUNCTION DEFINITIONS ---

/**
 * Sets up all modal open/close triggers.
 */
function initializeModals() {
  const openModal = ($el) => {
    $el.classList.add("is-active");
  };

  const closeModal = ($el) => {
    $el.classList.remove("is-active");
  };

  // Setup triggers to open modals on click
  document.querySelectorAll("[data-modal-target]").forEach(($trigger) => {
    const modalId = $trigger.dataset.modalTarget;
    const $target = document.querySelector(modalId);
    if ($target) {
      $trigger.addEventListener("click", () => {
        // Note: The form clearing logic is now handled by the app-specific JS
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