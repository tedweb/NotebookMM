import { LightningElement, api } from 'lwc';

export default class NsfConfirmationModal extends LightningElement {
    @api header = 'Confirm Delete';
    @api message = 'Are you sure?';
    @api confirmLabel = 'OK';
    @api cancelLabel = 'Cancel';

    _isOpen = false;

    @api
    open() {
        this._isOpen = true;
    }

    @api
    close() {
        this._isOpen = false;
    }

    get isOpen() {
        return this._isOpen;
    }

    handleConfirm() {
        this.dispatchEvent(new CustomEvent('confirm'));
        this.close();
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
        this.close();
    }
}
