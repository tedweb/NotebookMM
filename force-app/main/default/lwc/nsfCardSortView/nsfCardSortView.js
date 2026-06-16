import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCardsBySection from '@salesforce/apex/NSF_ContentController.getCardsBySection';
import saveCardOrder from '@salesforce/apex/NSF_ContentController.saveCardOrder';

export default class NsfCardSortView extends LightningElement {
    @api sectionId = '';

    @track _cards = [];
    @track _selectedIndex = -1;
    _isLoading = false;
    _isSaving = false;

    // ═══════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════

    connectedCallback() {
        this._loadCards();
    }

    // ═══════════════════════════════════════════════
    // DATA
    // ═══════════════════════════════════════════════

    async _loadCards() {
        this._isLoading = true;
        try {
            const result = await getCardsBySection({ sectionId: this.sectionId });
            this._cards = (result || []).map((c, idx) => ({
                id: c.Id,
                front: c.Front__c || '(empty)',
                orderNum: c.Order__c != null ? c.Order__c : idx + 1
            }));
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: e.body ? e.body.message : 'Failed to load cards',
                    variant: 'error'
                })
            );
        }
        this._isLoading = false;
    }

    // ═══════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════

    get isLoading() {
        return this._isLoading;
    }

    get isSaving() {
        return this._isSaving;
    }

    get hasCards() {
        return this._cards.length > 0;
    }

    get displayCards() {
        return this._cards.map((c, idx) => ({
            ...c,
            index: idx,
            position: idx + 1,
            isSelected: idx === this._selectedIndex,
            rowClass:
                'sort-row' +
                (idx === this._selectedIndex ? ' sort-row-selected' : '')
        }));
    }

    get canMoveUp() {
        return this._selectedIndex > 0;
    }

    get canMoveDown() {
        return (
            this._selectedIndex >= 0 &&
            this._selectedIndex < this._cards.length - 1
        );
    }

    // ═══════════════════════════════════════════════
    // HANDLERS
    // ═══════════════════════════════════════════════

    handleSelectRow(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        this._selectedIndex =
            this._selectedIndex === idx ? -1 : idx;
    }

    handleMoveUp() {
        if (!this.canMoveUp) return;
        const arr = [...this._cards];
        const i = this._selectedIndex;
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        this._cards = arr;
        this._selectedIndex = i - 1;
    }

    handleMoveDown() {
        if (!this.canMoveDown) return;
        const arr = [...this._cards];
        const i = this._selectedIndex;
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        this._cards = arr;
        this._selectedIndex = i + 1;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    async handleSave() {
        this._isSaving = true;
        try {
            const orderMap = this._cards.map((c, idx) => ({
                id: c.id,
                orderNum: idx + 1
            }));
            await saveCardOrder({
                serializedOrderMap: JSON.stringify(orderMap)
            });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Card order saved',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('save'));
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: e.body ? e.body.message : 'Failed to save order',
                    variant: 'error'
                })
            );
        }
        this._isSaving = false;
    }
}
