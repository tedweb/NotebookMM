import { LightningElement, api } from 'lwc';

export default class LwcModal extends LightningElement {
    @api header = '';
    @api confirmButtonLabel = 'Confirm';
    @api cancelButtonLabel = 'Cancel';
    @api confirmButtonVariant = 'brand';
    @api validateOnConfirm = false;
    @api errorMessage = '';
    @api focusSelectorString = '';

    _isOpen = false;

    @api
    get isOpen() {
        return this._isOpen;
    }
    set isOpen(value) {
        this._isOpen = value;
    }

    @api
    open() {
        this._isOpen = true;
        if (this.focusSelectorString) {
            // eslint-disable-next-line @lwc/lwc/no-async-operation
            setTimeout(() => {
                const el = this.template.querySelector(this.focusSelectorString);
                if (el && el.focus) {
                    el.focus();
                }
            }, 100);
        }
    }

    @api
    close() {
        this._isOpen = false;
    }

    get confirmButtonClass() {
        return `slds-button slds-button_${this.confirmButtonVariant}`;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
        this.close();
    }

    handleConfirm() {
        if (this.validateOnConfirm) {
            const inputFields = this.template.querySelectorAll(
                'lightning-input, lightning-combobox, lightning-textarea'
            );
            let allValid = true;
            if (inputFields) {
                inputFields.forEach((field) => {
                    if (field.reportValidity && !field.reportValidity()) {
                        allValid = false;
                    }
                });
            }
            if (!allValid) {
                return;
            }
        }
        this.dispatchEvent(new CustomEvent('confirm'));
    }

    handleKeyDown(event) {
        if (event.key === 'Escape') {
            this.handleCancel();
        }
    }

    handleBackdropClick() {
        this.handleCancel();
    }
}
