import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getCardsBySection from '@salesforce/apex/NSF_ContentController.getCardsBySection';
import deleteCard from '@salesforce/apex/NSF_ContentController.deleteCard';
import getLinkedResources from '@salesforce/apex/NSF_ContentController.getLinkedResources';
import getSectionsByNotebook from '@salesforce/apex/NSF_SectionController.getSectionsByNotebook';
import toggleBookmark from '@salesforce/apex/NSF_BookmarkController.toggleBookmark';
import isBookmarked from '@salesforce/apex/NSF_BookmarkController.isBookmarked';
import getBookmarkedItems from '@salesforce/apex/NSF_BookmarkController.getBookmarkedItems';

export default class NsfCardDetailView extends LightningElement {
    @api notebookId = '';
    @api sectionId = '';
    @api sectionTitle = '';

    // ─── State ────────────────────────────────────
    @track cards = [];
    @track sectionOptions = [];
    @track linkedResources = [];
    currentIndex = 0;
    _isFlipped = false;
    _isBookmarked = false;
    _showResources = false;
    _isLoading = true;
    _keyHandler;

    // ─── Bookmark section handling ────────────────
    _isBookmarkSection = false;

    // ═══════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════

    connectedCallback() {
        this._keyHandler = this.handleKeyDown.bind(this);
        // eslint-disable-next-line @lwc/lwc/no-document-query
        window.addEventListener('keydown', this._keyHandler);
        this._isBookmarkSection = this.sectionId === '__bookmarks__';
        this.loadSections();
        this.loadCards();
    }

    disconnectedCallback() {
        window.removeEventListener('keydown', this._keyHandler);
    }

    renderedCallback() {
        if (!this._isFlipped) {
            this._autoScaleFront();
        }
    }

    // ═══════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════

    async loadSections() {
        try {
            const sections = await getSectionsByNotebook({
                notebookId: this.notebookId
            });
            this.sectionOptions = sections.map(s => ({
                label: s.Title__c,
                value: s.Id
            }));
        } catch (e) {
            /* ignore */
        }
    }

    async loadCards() {
        this._isLoading = true;
        try {
            if (this._isBookmarkSection) {
                const bookmarks = await getBookmarkedItems({
                    notebookId: this.notebookId,
                    mode: 'Cards'
                });
                this.cards = (bookmarks || []).map(bm => ({
                    Id: bm.NSF_CardId__c,
                    Front__c: bm.NSF_CardId__r ? bm.NSF_CardId__r.Front__c : '',
                    Back__c: '',
                    NSF_SectionId__c: bm.NSF_SectionId__c
                }));
            } else {
                this.cards = await getCardsBySection({
                    sectionId: this.sectionId
                });
            }
            this.currentIndex = 0;
            this._isFlipped = false;
            if (this.cards.length > 0) {
                await this._checkBookmark();
            }
        } catch (e) {
            this.cards = [];
        }
        this._isLoading = false;
    }

    async _checkBookmark() {
        if (!this.currentCard) return;
        try {
            this._isBookmarked = await isBookmarked({
                recordId: this.currentCard.Id,
                recordType: 'Card'
            });
        } catch (e) {
            this._isBookmarked = false;
        }
    }

    async _loadLinkedResources() {
        if (!this.currentCard) return;
        try {
            this.linkedResources = await getLinkedResources({
                recordId: this.currentCard.Id,
                recordType: 'Card'
            });
        } catch (e) {
            this.linkedResources = [];
        }
    }

    // ═══════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════

    get currentCard() {
        return this.cards[this.currentIndex] || null;
    }

    get frontText() {
        return this.currentCard ? this.currentCard.Front__c || '' : '';
    }

    get backContent() {
        return this.currentCard ? this.currentCard.Back__c || '' : '';
    }

    get cardIndexLabel() {
        if (!this.cards.length) return '';
        return `Card ${this.currentIndex + 1} of ${this.cards.length}`;
    }

    get hasCards() {
        return this.cards.length > 0;
    }

    get hasPrevious() {
        return this.currentIndex > 0;
    }

    get hasNext() {
        return this.currentIndex < this.cards.length - 1;
    }

    get cardInnerClass() {
        return this._isFlipped ? 'card-inner flipped' : 'card-inner';
    }

    get bookmarkIcon() {
        return this._isBookmarked ? 'utility:favorite' : 'utility:favorite_alt';
    }

    get bookmarkVariant() {
        return this._isBookmarked ? 'brand' : 'bare';
    }

    get showResourcesPanel() {
        return this._showResources;
    }

    get hasLinkedResources() {
        return this.linkedResources.length > 0;
    }

    get selectedSectionId() {
        return this._isBookmarkSection ? '' : this.sectionId;
    }

    get isLoading() {
        return this._isLoading;
    }

    get deleteCardMessage() {
        return 'Click OK to continue with deleting this card. Otherwise, click Cancel.';
    }

    // ═══════════════════════════════════════════════
    // CARD INTERACTIONS
    // ═══════════════════════════════════════════════

    handleFlipCard() {
        this._isFlipped = !this._isFlipped;
    }

    toggleFlip() {
        this._isFlipped = !this._isFlipped;
    }

    handleKeyDown(event) {
        if (event.code === 'Space' || event.key === ' ') {
            // Don't flip if user is typing in an input/textarea
            const tagName = event.target.tagName.toLowerCase();
            if (tagName === 'input' || tagName === 'textarea') return;
            event.preventDefault();
            this.toggleFlip();
        }
    }

    async handlePrevious() {
        if (!this.hasPrevious) return;
        this._isFlipped = false;
        this._showResources = false;
        this.currentIndex--;
        await this._checkBookmark();
    }

    async handleNext() {
        if (!this.hasNext) return;
        this._isFlipped = false;
        this._showResources = false;
        this.currentIndex++;
        await this._checkBookmark();
    }

    // ─── Section Selector ─────────────────────────
    async handleSectionChange(event) {
        const newSectionId = event.detail.value;
        this.sectionId = newSectionId;
        this._isBookmarkSection = false;
        const match = this.sectionOptions.find(
            o => o.value === newSectionId
        );
        this.sectionTitle = match ? match.label : '';
        await this.loadCards();
    }

    // ═══════════════════════════════════════════════
    // VIEW RESOURCES
    // ═══════════════════════════════════════════════

    async handleViewResources() {
        if (this._showResources) {
            this._showResources = false;
            return;
        }
        await this._loadLinkedResources();
        this._showResources = true;
    }

    // ═══════════════════════════════════════════════
    // BOOKMARK TOGGLE
    // ═══════════════════════════════════════════════

    async handleToggleBookmark() {
        if (!this.currentCard) return;
        try {
            const result = await toggleBookmark({
                recordId: this.currentCard.Id,
                recordType: 'Card',
                sectionId: this.currentCard.NSF_SectionId__c
            });
            this._isBookmarked = result;
        } catch (e) {
            this.showError('Bookmark failed', e);
        }
    }

    // ═══════════════════════════════════════════════
    // ACTION BUTTONS
    // ═══════════════════════════════════════════════

    handleAdd() {
        this.dispatchEvent(
            new CustomEvent('add', {
                detail: { cardId: null, sectionId: this.sectionId }
            })
        );
    }

    handleEdit() {
        if (!this.currentCard) return;
        this.dispatchEvent(
            new CustomEvent('edit', {
                detail: {
                    cardId: this.currentCard.Id,
                    sectionId: this.sectionId
                }
            })
        );
    }

    handleSort() {
        this.dispatchEvent(
            new CustomEvent('sort', {
                detail: { sectionId: this.sectionId }
            })
        );
    }

    handleDelete() {
        if (!this.currentCard) return;
        this.template
            .querySelector('c-nsf-confirmation-modal[data-id="delete-card"]')
            .open();
    }

    async handleConfirmDeleteCard() {
        try {
            await deleteCard({ cardId: this.currentCard.Id });
            this.showSuccess('Card deleted');
            // Adjust index if needed
            if (this.currentIndex >= this.cards.length - 1 && this.currentIndex > 0) {
                this.currentIndex--;
            }
            await this.loadCards();
        } catch (e) {
            this.showError('Delete failed', e);
        }
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
    }

    // ═══════════════════════════════════════════════
    // AUTO-SCALE FRONT TEXT
    // ═══════════════════════════════════════════════

    _autoScaleFront() {
        const textEl = this.template.querySelector('.card-front-text');
        const container = this.template.querySelector('.card-face-front');
        if (!textEl || !container) return;

        let fontSize = 48;
        textEl.style.fontSize = fontSize + 'px';
        // eslint-disable-next-line no-unmodified-loop-condition
        while (textEl.scrollHeight > container.clientHeight && fontSize > 14) {
            fontSize -= 2;
            textEl.style.fontSize = fontSize + 'px';
        }
    }

    // ═══════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════

    showSuccess(message) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: 'Success',
                message: message,
                variant: 'success'
            })
        );
    }

    showError(title, error) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message:
                    typeof error === 'string'
                        ? error
                        : error.body
                        ? error.body.message
                        : error.message || 'Unknown error',
                variant: 'error'
            })
        );
    }
}
