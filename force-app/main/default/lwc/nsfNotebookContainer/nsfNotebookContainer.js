import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getNotebookDetail from '@salesforce/apex/NSF_CatalogController.getNotebookDetail';
import upsertSection from '@salesforce/apex/NSF_SectionController.upsertSection';
import notebookIcon from '@salesforce/resourceUrl/notebook_icon_inverted';

export default class NsfNotebookContainer extends LightningElement {
    @track notebookId = '';
    @track notebookTitle = '';
    @track topicTitle = '';
    @track activeMode = 'Resources'; // default mode
    @track isDetailViewOpen = false;

    // ─── Section modal state ──────────────────────────
    sectionModalHeader = '';
    sectionModalTitle = '';
    sectionModalId = null;
    sectionModalError = '';
    _wiredNotebookResult;

    connectedCallback() {
        this.template.addEventListener('editsection', (event) => {
            this.handleEditSection(event);
        });
        this.template.addEventListener('detailviewopen', () => {
            this.isDetailViewOpen = true;
        });
        this.template.addEventListener('detailviewclose', () => {
            this.isDetailViewOpen = false;
        });
    }

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        if (pageRef && pageRef.state) {
            this.notebookId = pageRef.state.c__notebookId || '';
            this.notebookTitle = pageRef.state.c__notebookTitle || '';
        }
    }

    @wire(getNotebookDetail, { notebookId: '$notebookId' })
    wiredNotebook(result) {
        this._wiredNotebookResult = result;
        const { data, error } = result;
        if (data) {
            this.topicTitle = data.NSF_TopicId__r ? data.NSF_TopicId__r.Title__c : '';
        }
        if (error) {
            this.topicTitle = '';
        }
    }

    get notebookIconUrl() {
        return notebookIcon;
    }

    // ─── Mode getters ────────────────────────
    get isResourcesMode() {
        return this.activeMode === 'Resources';
    }

    get isNotesMode() {
        return this.activeMode === 'Notes';
    }

    get isCardsMode() {
        return this.activeMode === 'Cards';
    }

    get isExamsMode() {
        return this.activeMode === 'Exams';
    }

    get hasNotebook() {
        return !!this.notebookId;
    }

    get computedModeContentClass() {
        const base = 'mode-content';
        return this.isDetailViewOpen ? `${base} no-padding` : base;
    }

    handleModeChange(event) {
        this.activeMode = event.detail.mode;
    }

    handleAddSection() {
        this.sectionModalHeader = 'Create Section';
        this.sectionModalTitle = '';
        this.sectionModalId = null;
        this.sectionModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="section-modal"]').open();
        this._focusModalInput('section-modal');
    }

    handleEditSection(event) {
        this.sectionModalHeader = 'Edit Section';
        this.sectionModalTitle = event.detail.sectionTitle;
        this.sectionModalId = event.detail.sectionId;
        this.sectionModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="section-modal"]').open();
        this._focusModalInput('section-modal');
    }

    handleSectionTitleChange(event) {
        this.sectionModalTitle = event.target.value;
    }

    async handleSectionConfirm() {
        if (!this.sectionModalTitle || !this.sectionModalTitle.trim()) {
            this.sectionModalError = 'Title is required.';
            return;
        }
        try {
            await upsertSection({
                sectionId: this.sectionModalId,
                title: this.sectionModalTitle.trim(),
                notebookId: this.notebookId
            });
            this.template.querySelector('c-lwc-modal[data-id="section-modal"]').close();
            this.showSuccess(
                this.sectionModalId ? 'Section updated' : 'Section created'
            );
            // Dispatch event to refresh list views
            this.dispatchEvent(new CustomEvent('sectionschanged', {
                bubbles: true,
                composed: true
            }));
        } catch (error) {
            this.sectionModalError = this.reduceError(error);
        }
    }

    _focusModalInput(modalDataId) {
        // eslint-disable-next-line @lwc/lwc/no-async-operation
        setTimeout(() => {
            const modal = this.template.querySelector(`c-lwc-modal[data-id="${modalDataId}"]`);
            if (modal) {
                const input = modal.querySelector('lightning-input');
                if (input) {
                    input.focus();
                }
            }
        }, 150);
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

    reduceError(error) {
        if (typeof error === 'string') {
            return error;
        }
        if (error.body && error.body.message) {
            return error.body.message;
        }
        if (error.message) {
            return error.message;
        }
        return 'An unknown error occurred.';
    }
}
