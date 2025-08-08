document.addEventListener("DOMContentLoaded", () => {
  let iconPickerInstance = null;
  let editIconPickerInstance = null;

  const clearForm = (form) => {
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
      } else if (tagName === 'select' && !field.classList.contains('js-choice-icon-picker')) {
        field.selectedIndex = -1;
      } else {
        field.value = '';
      }
    }

    const errorSummary = form.querySelector('.form-error-summary');
    if (errorSummary) errorSummary.remove();
    form.querySelectorAll('.has-error').forEach(el => el.classList.remove('has-error'));
    form.querySelectorAll('input, select').forEach(el => el.disabled = false);

    if (form.closest('#add-type-modal') && iconPickerInstance) {
      iconPickerInstance.setChoiceByValue('warehouse');
    }
    if (form.closest('#edit-type-modal') && editIconPickerInstance) {
      editIconPickerInstance.setChoiceByValue('warehouse');
    }
  };

  function handleConditionalGridFields(container) {
    const hasSpacesCheckbox = container.querySelector('input[name="has_spaces"]');
    const rowsInput = container.querySelector('input[name="rows"]');
    const colsInput = container.querySelector('input[name="columns"]');

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

  function initializeIconPicker() {
    const initChoices = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      return new Choices(element, {
        searchEnabled: false,
        callbackOnCreateTemplates: function(template) {
          return {
            item: ({ classNames }, data) => {
              return template(
                `<div class="${classNames.item}" data-item data-id="${data.id}" data-value="${data.value}"><span class="material-symbols-outlined">${data.value}</span></div>`
              );
            },
            choice: ({ classNames }, data) => {
              return template(
                `<div class="${classNames.item} ${classNames.itemChoice} ${data.disabled ? classNames.itemDisabled : ''} ${data.highlighted ? classNames.highlightedState : ''}" data-select-text="" data-choice data-id="${data.id}" data-value="${data.value}" role="option"><span class="material-symbols-outlined">${data.value}</span></div>`
              );
            },
          };
        },
      });
    };

    iconPickerInstance = initChoices('#add-type-modal .js-choice-icon-picker');
    editIconPickerInstance = initChoices('#edit-type-modal .js-choice-icon-picker');
  }

  function initializeEditTypeButtons() {
    const editButtons = document.querySelectorAll('.edit-type-btn');
    const modal = document.querySelector('#edit-type-modal');
    if (!modal) return;

    const form = modal.querySelector('form');

    editButtons.forEach(button => {
      button.addEventListener('click', (event) => {
        event.preventDefault();
        clearForm(form);

        const data = JSON.parse(button.dataset.data);

        form.querySelector('input[name="location_type_id"]').value = data['location_type_id'];
        form.querySelector('input[name="name"]').value = data.name;
        if (editIconPickerInstance) editIconPickerInstance.setChoiceByValue(data.icon);

        if (data.allowed_parents) {
          data.allowed_parents.forEach(parentId => {
            const checkbox = form.querySelector(`input[name="allowed_parents"][value="${parentId}"]`);
            if (checkbox) checkbox.checked = true;
          });
        }

        form.querySelector('input[name="can_store_inventory"]').checked = data.can_store_inventory;
        form.querySelector('input[name="can_store_samples"]').checked = data.can_store_samples;
        form.querySelector('input[name="has_spaces"]').checked = data.has_spaces;
        form.querySelector('input[name="rows"]').value = data.rows;
        form.querySelector('input[name="columns"]').value = data.columns;

        if (data['is-in-use']) {
          form.querySelector('input[name="name"]').disabled = true;
          form.querySelector('input[name="has_spaces"]').disabled = true;
        }

        handleConditionalGridFields(modal);
        modal.classList.add('is-active');
      });
    });
  }

  // --- Initializers for THIS page ---
  initializeIconPicker();
  initializeEditTypeButtons();

  // Re-run conditional logic when the Add modal is triggered from main.js
  const addModalButton = document.querySelector('[data-modal-target="#add-type-modal"]');
  const addModal = document.querySelector("#add-type-modal");

  if (addModalButton && addModal) {
      addModalButton.addEventListener('click', () => {
          handleConditionalGridFields(addModal);
      });
  }
});