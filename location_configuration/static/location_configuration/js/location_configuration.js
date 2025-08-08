document.addEventListener("DOMContentLoaded", () => {
  // This listener is the key fix. It waits for the "Add" button to be clicked.
  const addModalButton = document.querySelector('[data-modal-target="#add-type-modal"]');
  const addModal = document.querySelector("#add-type-modal");

  if (addModalButton && addModal) {
      addModalButton.addEventListener('click', () => {
          // The global main.js script has already cleared the form.
          // Now, we run our page-specific logic to disable the fields correctly.
          handleConditionalGridFields(addModal);
      });
  }
});