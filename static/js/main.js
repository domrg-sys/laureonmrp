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
  (document.querySelectorAll(".modal-overlay") || []).forEach(($overlay) => {
    $overlay.addEventListener("click", (event) => {
      if (event.target.classList.contains('modal-overlay') || event.target.closest('.modal-close')) {
         closeModal($overlay);
      }
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
    slider.style.left = `${active_tab.offsetLeft}px`;
}

// Run the function when the page loads
document.addEventListener('DOMContentLoaded', handleTabSlider);

// Also run it if the browser window is resized
window.addEventListener('resize', handleTabSlider);

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

// Spaces Function

function handleConditionalGridFields() {
    // Find the relevant elements in the form
    const hasSpacesCheckbox = document.getElementById('id_has_spaces');
    const rowsInput = document.getElementById('id_rows');
    const colsInput = document.getElementById('id_columns');

    // If these elements don't exist on the page, do nothing.
    if (!hasSpacesCheckbox || !rowsInput || !colsInput) {
        return;
    }

    // This function will be called to update the state of the inputs
    const toggleGridInputs = () => {
        const isChecked = hasSpacesCheckbox.checked;
        rowsInput.disabled = !isChecked;
        colsInput.disabled = !isChecked;

        // If the box is unchecked, clear the values
        if (!isChecked) {
            rowsInput.value = '';
            colsInput.value = '';
        }
    };

    // Run the function once on page load to set the initial state
    toggleGridInputs();

    // Add an event listener to run the function whenever the checkbox is clicked
    hasSpacesCheckbox.addEventListener('change', toggleGridInputs);
}

// Ensure the script runs after the page has fully loaded
document.addEventListener('DOMContentLoaded', handleConditionalGridFields);

//icon picker
function initializeIconPicker() {
    const iconPicker = document.getElementById('icon-picker');
    
    // If the icon picker element doesn't exist on the page, do nothing.
    if (!iconPicker) {
        return;
    }

    new TomSelect(iconPicker, {
        plugins: ['grid_view'], // This plugin enables the grid layout for options.

        render: {
            // This function now only renders the icon for each option in the grid.
            option: function(data, escape) {
                return `<div class="grid-item">
                          <span class="material-symbols-outlined">${escape(data.value)}</span>
                        </div>`;
            },
            // This function now only renders the icon for the currently selected item.
            item: function(data, escape) {
                return `<div class="select-item">
                          <span class="material-symbols-outlined">${escape(data.value)}</span>
                        </div>`;
            }
        }
    });
}

// The event listener at the bottom of the file stays the same.
document.addEventListener('DOMContentLoaded', initializeIconPicker);