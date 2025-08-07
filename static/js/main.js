// Modal Script
document.addEventListener("DOMContentLoaded", () => {

  // Function to open a modal
  function openModal($el) {
    $el.classList.add("is-active");
  }

  // Function to close a modal
  function closeModal($el) {
    $el.classList.remove("is-active");
  }

  // Add a click event on buttons to open a specific modal
  (document.querySelectorAll("[data-modal-target]") || []).forEach(($trigger) => {
    const modalId = $trigger.dataset.modalTarget;
    const $target = document.querySelector(modalId);

    $trigger.addEventListener("click", () => {
      openModal($target);
    });
  });

  // Add a click event on various triggers to close all modals
  (document.querySelectorAll(".modal-overlay, .modal-close") || []).forEach(($close) => {
    const $target = $close.closest(".modal-overlay");

    $close.addEventListener("click", (event) => {
      // Prevent clicks inside the modal content from closing it
      if (event.target === $target.querySelector('.modal-content') || $target.querySelector('.modal-content').contains(event.target)) {
        return;
      }
      closeModal($target);
    });
  });
});

// Tab Slider
function handleTabSlider() {
    const nav = document.querySelector('.tab-nav');
    if (!nav) return; // Don't run if there's no tab nav on the page

    const slider = nav.querySelector('.tab-nav-slider');
    const activeTab = nav.querySelector('.tab-nav-item.is-active');

    // Make sure both the slider and an active tab exist
    if (!slider || !activeTab) return;

    // Move the slider to the exact position and width of the active tab
    slider.style.width = `${activeTab.offsetWidth}px`;
    slider.style.left = `${activeTab.offsetLeft}px`;
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', handleTabSlider);

// Also run it if the browser window is resized
window.addEventListener('resize', handleTabSlider);