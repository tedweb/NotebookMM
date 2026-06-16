import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import upsertCard from '@salesforce/apex/NSF_ContentController.upsertCard';
import getLinkedResources from '@salesforce/apex/NSF_ContentController.getLinkedResources';
import getCardsBySection from '@salesforce/apex/NSF_ContentController.getCardsBySection';

export default class NsfCardUpsertWizard extends LightningElement {
    @api notebookId = '';
    @api sectionId = '';
    @api cardId = null;

    // ─── Wizard state ─────────────────────────────
    @track currentPage = 1; // 1=Front, 2=Back, 3=Resources
    @track frontText = '';
    @track backContent = '';
    @track selectedResources = [];
    _orderNum = null;
    _isLoading = false;

    // ─── Rich text formats ────────────────────────
    get richTextFormats() {
        return [
            'font', 'size', 'bold', 'italic', 'underline', 'strike',
            'list', 'indent', 'align', 'link', 'clean', 'table', 'header'
        ];
    }

    // ═══════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════

    connectedCallback() {
        if (this.cardId) {
            this._loadExistingCard();
        }
    }

    renderedCallback() {
        if (this.currentPage === 1) {
            this._autoScaleFrontInput();
        }
    }

    // ═══════════════════════════════════════════════
    // DATA LOADING (edit mode)
    // ═══════════════════════════════════════════════

    async _loadExistingCard() {
        this._isLoading = true;
        try {
            // Load card data
            const cards = await getCardsBySection({
                sectionId: this.sectionId
            });
            const card = cards.find(c => c.Id === this.cardId);
            if (card) {
                this.frontText = card.Front__c || '';
                this.backContent = card.Back__c || '';
                this._orderNum = card.Order__c;
            }

            // Load linked resources
            const resources = await getLinkedResources({
                recordId: this.cardId,
                recordType: 'Card'
            });
            this.selectedResources = (resources || []).map(r => ({
                id: r.Id,
                title: r.Title__c,
                link: r.Link__c,
                type: r.Type__c
            }));
        } catch (e) {
            /* ignore */
        }
        this._isLoading = false;
    }

    // ═══════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════

    get isPage1() {
        return this.currentPage === 1;
    }

    get isPage2() {
        return this.currentPage === 2;
    }

    get isPage3() {
        return this.currentPage === 3;
    }

    get pageLabel() {
        if (this.currentPage === 1) return 'Front Side';
        if (this.currentPage === 2) return 'Back Side';
        return 'Card Resource(s)';
    }

    get isEditing() {
        return !!this.cardId;
    }

    get showBackButton() {
        return this.currentPage > 1;
    }

    get showNextButton() {
        return this.currentPage < 3;
    }

    get showSaveButton() {
        return this.currentPage === 3;
    }

    get isLoading() {
        return this._isLoading;
    }

    get excludeResourceIds() {
        return this.selectedResources.map(r => r.id);
    }

    // ═══════════════════════════════════════════════
    // PAGE 1: FRONT SIDE
    // ═══════════════════════════════════════════════

    handleFrontTextChange(event) {
        this.frontText = event.target.value;
    }

    _autoScaleFrontInput() {
        const textEl = this.template.querySelector('.front-text-display');
        const container = this.template.querySelector('.front-preview-area');
        if (!textEl || !container) return;

        let fontSize = 36;
        textEl.style.fontSize = fontSize + 'px';
        while (textEl.scrollHeight > container.clientHeight && fontSize > 14) {
            fontSize -= 2;
            textEl.style.fontSize = fontSize + 'px';
        }
    }

    // ═══════════════════════════════════════════════
    // PAGE 2: BACK SIDE
    // ═══════════════════════════════════════════════

    handleBackContentChange(event) {
        this.backContent = event.target.value;
    }

    // ═══════════════════════════════════════════════
    // PAGE 3: RESOURCES
    // ═══════════════════════════════════════════════

    handleResourceSelect(event) {
        const { resourceId, resourceTitle, resourceLink, resourceType } =
            event.detail;
        // Prevent duplicates
        if (this.selectedResources.some(r => r.id === resourceId)) return;
        this.selectedResources = [
            ...this.selectedResources,
            {
                id: resourceId,
                title: resourceTitle,
                link: resourceLink,
                type: resourceType
            }
        ];
    }

    handleResourceReorder(event) {
        this.selectedResources = event.detail.resources;
    }

    handleResourceRemove(event) {
        const removeId = event.detail.resourceId;
        this.selectedResources = this.selectedResources.filter(
            r => r.id !== removeId
        );
    }

    // ═══════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════

    handleNext() {
        if (this.currentPage === 1 && !this.frontText.trim()) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Validation',
                    message: 'Please enter front side content.',
                    variant: 'warning'
                })
            );
            return;
        }
        if (this.currentPage < 3) {
            this.currentPage++;
        }
    }

    handleBack() {
        if (this.currentPage > 1) {
            this.currentPage--;
        }
    }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    // ═══════════════════════════════════════════════
    // SAVE
    // ═══════════════════════════════════════════════

    async handleSave() {
        this._isLoading = true;
        try {
            const resourceIds = this.selectedResources.map(r => r.id);
            await upsertCard({
                cardId: this.cardId,
                front: this.frontText,
                back: this.backContent,
                orderNum: this._orderNum,
                sectionId: this.sectionId,
                resourceIds: resourceIds
            });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: this.isEditing
                        ? 'Card updated'
                        : 'Card created',
                    variant: 'success'
                })
            );
            this.dispatchEvent(new CustomEvent('save'));
        } catch (e) {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Error',
                    message:
                        e.body ? e.body.message : e.message || 'Save failed',
                    variant: 'error'
                })
            );
        }
        this._isLoading = false;
    }
}
