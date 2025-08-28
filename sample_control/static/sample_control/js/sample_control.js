/**
 * Handles the click event on a tree toggle arrow to expand or collapse a subtree.
 */
function handleTreeToggleClick(event) {
  event.stopPropagation(); // Prevent the location selection event
  const toggle = event.currentTarget;
  const subtree = toggle.closest('.location-node').querySelector('.location-subtree');
  
  if (subtree) {
    toggle.classList.toggle('is-open');
    subtree.style.display = toggle.classList.contains('is-open') ? 'block' : 'none';
  }
}

/**
 * Fetches and renders the details for a given location ID into the details panel.
 */
async function fetchAndRenderLocationDetails(locationId, detailsPanel) {
  detailsPanel.innerHTML = '<p>Loading...</p>'; 
  try {
    const response = await fetch(`/sample_control/location/${location_id}/`);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    const data = await response.json();
    detailsPanel.innerHTML = data.html;
  } catch (error) {
    console.error("Failed to fetch location details:", error);
    detailsPanel.innerHTML = '<p class="error">Could not load location details.</p>';
  }
}

/**
 * Handles the click event on a location node in the tree to select it.
 */
function handleLocationSelect(event) {
  const nodeContent = event.currentTarget;
  if (nodeContent.classList.contains('cannot-store-samples')) {
    return;
  }

  const currentActive = document.querySelector('.location-node-content.is-active');
  if (currentActive) {
    currentActive.classList.remove('is-active');
  }

  nodeContent.classList.add('is-active');
  const locationId = nodeContent.closest('.location-node').dataset.locationId;
  const detailsPanel = document.querySelector('.location-details-panel');
  
  fetchAndRenderLocationDetails(locationId, detailsPanel);
}

/**
 * Handles the click on a specific space cell within the grid.
 */
function handleSpaceClick(spaceCell) {
    const spaceId = spaceCell.dataset.spaceId;
    const isOccupied = spaceCell.classList.contains('is-occupied');
    
    if (isOccupied) {
        console.log(`CHECK-OUT sample from Space ID: ${spaceId}`);
        // Future: Open check-out modal
    } else {
        console.log(`CHECK-IN sample to Space ID: ${spaceId}`);
        // Future: Open check-in modal
    }
}

/**
 * Handles all clicks inside the details panel, delegating to child elements.
 */
function handleDetailsPanelClick(event) {
    const spaceCell = event.target.closest('.space-cell');
    if (spaceCell && !spaceCell.classList.contains('is-invalid')) {
        handleSpaceClick(spaceCell);
    }
}

/**
 * Attaches all necessary event listeners for the sample control page.
 */
function initializeSampleControlPage() {
  document.querySelectorAll('.tree-toggle').forEach(toggle => {
    toggle.addEventListener('click', handleTreeToggleClick);
  });

  document.querySelectorAll('.location-node-content').forEach(nodeContent => {
    nodeContent.addEventListener('click', handleLocationSelect);
  });
  
  const detailsPanel = document.querySelector('.location-details-panel');
  if (detailsPanel) {
      detailsPanel.addEventListener('click', handleDetailsPanelClick);
  }
}

// --- Main Entry Point ---
document.addEventListener('DOMContentLoaded', initializeSampleControlPage);