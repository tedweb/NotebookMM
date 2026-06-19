import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getCardSectionSummaries from '@salesforce/apex/NSF_ContentController.getCardSectionSummaries';
import getBookmarkedItems from '@salesforce/apex/NSF_BookmarkController.getBookmarkedItems';
import getSectionsByNotebook from '@salesforce/apex/NSF_SectionController.getSectionsByNotebook';
import upsertSection from '@salesforce/apex/NSF_SectionController.upsertSection';
import deleteSection from '@salesforce/apex/NSF_SectionController.deleteSection';

export default class NsfCardListView extends LightningElement {
    @api notebookId = '';
    @api hideAddSection = false;

    // ─── Data ─────────────────────────────────────
    @track sectionSummaries = [];
    @track bookmarkSummary = null;
    _wiredSummariesResult;
    _wiredBookmarksResult;
    _wiredSectionsResult;
    _totalCards = 0;

    // ─── View state ───────────────────────────────
    @track currentView = 'list'; // list | detail | upsert | sort
    detailSectionId = '';
    detailSectionTitle = '';
    upsertCardId = null;
    upsertSectionId = '';

    // ─── Delete confirmation state ────────────────
    deleteTarget = {};

    // ═══════════════════════════════════════════════
    // WIRES
    // ═══════════════════════════════════════════════

    @wire(getCardSectionSummaries, { notebookId: '$notebookId' })
    wiredSummaries(result) {
        this._wiredSummariesResult = result;
        if (result.data) {
            this._totalCards = result.data.reduce(
                (sum, s) => sum + (s.itemCount || 0),
                0
            );
            this.sectionSummaries = result.data.map(s => ({
                sectionId: s.sectionId,
                sectionTitle: s.sectionTitle,
                sectionName: s.sectionName,
                itemCount: s.itemCount || 0,
                lastModified: s.lastModified,
                percentage: this._calcPercentage(s.itemCount),
                countLabel: `Total cards in deck: ${s.itemCount || 0}`,
                dateLabel: s.lastModified
                    ? `Last Modified: ${new Date(s.lastModified).toLocaleDateString()}`
                    : ''
            }));
        }
        if (result.error) {
            this.showError('Error loading card sections', result.error);
        }
    }

    @wire(getBookmarkedItems, { notebookId: '$notebookId', mode: 'Cards' })
    wiredBookmarks(result) {
        this._wiredBookmarksResult = result;
        if (result.data && result.data.length > 0) {
            this.bookmarkSummary = {
                itemCount: result.data.length,
                countLabel: `Total cards in deck: ${result.data.length}`,
                dateLabel: ''
            };
        } else {
            this.bookmarkSummary = {
                itemCount: 0,
                countLabel: 'Total cards in deck: 0',
                dateLabel: ''
            };
        }
        if (result.error) {
            this.bookmarkSummary = null;
        }
    }

    @wire(getSectionsByNotebook, { notebookId: '$notebookId' })
    wiredSections(result) {
        this._wiredSectionsResult = result;
    }

    // ═══════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════

    get isListView() {
        return this.currentView === 'list';
    }

    get isDetailView() {
        return this.currentView === 'detail';
    }

    get isUpsertView() {
        return this.currentView === 'upsert';
    }

    get isSortView() {
        return this.currentView === 'sort';
    }

    get hasSections() {
        return this.sectionSummaries && this.sectionSummaries.length > 0;
    }

    get hasBookmarks() {
        return this.bookmarkSummary && this.bookmarkSummary.itemCount > 0;
    }

    get deleteSectionMessage() {
        return 'Click OK to continue with deleting this section. All contents within the section will be deleted.';
    }

    // ═══════════════════════════════════════════════
    // OPEN DECK
    // ═══════════════════════════════════════════════

    handleOpenDeck(event) {
        const sectionId = event.currentTarget.dataset.sectionId;
        const sectionTitle = event.currentTarget.dataset.sectionTitle;
        this.detailSectionId = sectionId;
        this.detailSectionTitle = sectionTitle || '';
        this.currentView = 'detail';
    }

    handleOpenBookmarkDeck() {
        this.detailSectionId = '__bookmarks__';
        this.detailSectionTitle = 'Bookmarked Cards';
        this.currentView = 'detail';
    }

    // ═══════════════════════════════════════════════
    // DETAIL VIEW CALLBACKS
    // ═══════════════════════════════════════════════

    handleCloseDetail() {
        this.currentView = 'list';
        this._refreshAll();
    }

    handleOpenUpsert(event) {
        this.upsertCardId = event.detail.cardId || null;
        this.upsertSectionId = event.detail.sectionId || this.detailSectionId;
        this.currentView = 'upsert';
    }

    handleOpenSort(event) {
        this.detailSectionId = event.detail.sectionId || this.detailSectionId;
        this.currentView = 'sort';
    }

    handleUpsertSave() {
        this.currentView = 'detail';
        this._refreshAll();
    }

    handleUpsertCancel() {
        this.currentView = 'detail';
    }

    handleSortSave() {
        this.currentView = 'detail';
        this._refreshAll();
    }

    handleSortCancel() {
        this.currentView = 'detail';
    }

    // ═══════════════════════════════════════════════
    // SECTION CRUD
    // ═══════════════════════════════════════════════

    handleEditSection(event) {
        this.dispatchEvent(new CustomEvent('editsection', {
            detail: {
                sectionId: event.detail.sectionId,
                sectionTitle: event.detail.sectionTitle
            },
            bubbles: true,
            composed: true
        }));
    }

    handleDeleteSection(event) {
        this.deleteTarget = {
            type: 'section',
            id: event.detail.sectionId,
            title: event.detail.sectionTitle
        };
        this.template
            .querySelector('c-nsf-confirmation-modal[data-id="delete-section"]')
            .open();
    }

    async handleConfirmDeleteSection() {
        try {
            await deleteSection({ sectionId: this.deleteTarget.id });
            this.showSuccess('Section deleted');
            await this._refreshAll();
        } catch (error) {
            this.showError('Delete failed', error);
        }
    }

    // ═══════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════

    _calcPercentage(count) {
        if (!this._totalCards || !count) return '';
        return Math.round((count / this._totalCards) * 100) + '%';
    }

    async _refreshAll() {
        const promises = [];
        if (this._wiredSummariesResult) {
            promises.push(refreshApex(this._wiredSummariesResult));
        }
        if (this._wiredBookmarksResult) {
            promises.push(refreshApex(this._wiredBookmarksResult));
        }
        if (this._wiredSectionsResult) {
            promises.push(refreshApex(this._wiredSectionsResult));
        }
        await Promise.all(promises);
    }

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
                message: this.reduceError(error),
                variant: 'error'
            })
        );
    }

    reduceError(error) {
        if (typeof error === 'string') return error;
        if (error.body && error.body.message) return error.body.message;
        if (error.message) return error.message;
        return 'An unknown error occurred.';
    }
}
