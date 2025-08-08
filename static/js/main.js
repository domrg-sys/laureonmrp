/**
 * Main entry point for all JavaScript on the site.
 */
document.addEventListener("DOMContentLoaded", () => {
  initializeModalClosing();
  handleTabSlider();
});


// --- FUNCTION DEFINITIONS ---

/**
 * Sets up triggers to CLOSE any active modal.
 * This is a generic service for the whole site.
 */
function initializeModalClosing() {
  const closeModal = ($el) => {
    $el.classList.remove("is-active");
  };

  document.querySelectorAll(".modal-overlay").forEach(($overlay) => {
    // Add listener to the overlay background and the 'X' button
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