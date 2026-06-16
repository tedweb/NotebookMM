import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getExamsBySection from '@salesforce/apex/NSF_ContentController.getExamsBySection';
import saveExamOrder from '@salesforce/apex/NSF_ContentController.saveExamOrder';

export default class NsfExamSortView extends LightningElement {
    @api sectionId = '';

    @track _exams = [];
    @track _selectedIndex = -1;
    _isLoading = false;
    _isSaving = false;

    // ═══════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════

    connectedCallback() {
        this._loadExams();
    }

    // ═══════════════════════════════════════════════
    // DATA
    // ═══════════════════════════════════════════════

    async _loadExams() {
        this._isLoading = true;
        try {
            const result = await getExamsBySection({ sectionId: this.sectionId });
            this._exams = (result || []).map((e, idx) => ({
                id: e.Id,
                question: e.Question__c || '(empty)',
                orderNum: e.Order__c != null ? e.Order__c : idx + 1
            }));
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message: e.body ? e.body.message : 'Failed to load questions',
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

    get hasExams() {
        return this._exams.length > 0;
    }

    get displayExams() {
        return this._exams.map((e, idx) => ({
            ...e,
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
            this._selectedIndex < this._exams.length - 1
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
        const arr = [...this._exams];
        const i = this._selectedIndex;
        [arr[i - 1], arr[i]] = [arr[i], arr[i - 1]];
        this._exams = arr;
        this._selectedIndex = i - 1;
    }

    handleMoveDown() {
        if (!this.canMoveDown) return;
        const arr = [...this._exams];
        const i = this._selectedIndex;
        [arr[i], arr[i + 1]] = [arr[i + 1], arr[i]];
        this._exams = arr;
        this._selectedIndex = i + 1;
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    async handleSave() {
        this._isSaving = true;
        try {
            const orderMap = this._exams.map((e, idx) => ({
                id: e.id,
                orderNum: idx + 1
            }));
            await saveExamOrder({
                serializedOrderMap: JSON.stringify(orderMap)
            });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: 'Question order saved',
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
