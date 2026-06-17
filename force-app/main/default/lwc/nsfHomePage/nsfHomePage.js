import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { IsConsoleNavigation, openTab } from 'lightning/platformWorkspaceApi';
import { refreshApex } from '@salesforce/apex';
import getCatalogs from '@salesforce/apex/NSF_CatalogController.getCatalogs';
import getTopicsWithNotebooks from '@salesforce/apex/NSF_CatalogController.getTopicsWithNotebooks';
import upsertCatalog from '@salesforce/apex/NSF_CatalogController.upsertCatalog';
import upsertTopic from '@salesforce/apex/NSF_CatalogController.upsertTopic';
import upsertNotebook from '@salesforce/apex/NSF_CatalogController.upsertNotebook';
import deleteCatalog from '@salesforce/apex/NSF_CatalogController.deleteCatalog';
import deleteTopic from '@salesforce/apex/NSF_CatalogController.deleteTopic';
import deleteNotebook from '@salesforce/apex/NSF_CatalogController.deleteNotebook';

export default class NsfHomePage extends NavigationMixin(LightningElement) {
    // ─── Console detection ─────────────────────────────────
    @wire(IsConsoleNavigation)
    isConsole;

    // ─── Wired data holders ────────────────────────────────
    @track catalogs = [];
    @track topics = [];
    selectedCatalogId = '';
    _wiredCatalogsResult;
    _wiredTopicsResult;

    // ─── Modal state: Catalog ──────────────────────────────
    catalogModalHeader = '';
    catalogModalTitle = '';
    catalogModalId = null;
    catalogModalError = '';

    // ─── Modal state: Topic ────────────────────────────────
    topicModalHeader = '';
    topicModalTitle = '';
    topicModalId = null;
    topicModalCatalogId = '';
    topicModalError = '';

    // ─── Modal state: Notebook ─────────────────────────────
    notebookModalHeader = '';
    notebookModalTitle = '';
    notebookModalId = null;
    notebookModalTopicId = '';
    notebookModalError = '';

    // ─── Delete confirmation state ─────────────────────────
    deleteTarget = {};

    // ─── Wire: getCatalogs ─────────────────────────────────
    @wire(getCatalogs)
    wiredCatalogs(result) {
        this._wiredCatalogsResult = result;
        if (result.data) {
            this.catalogs = result.data;
            // Auto-select first catalog if none selected
            if (!this.selectedCatalogId && this.catalogs.length > 0) {
                this.selectedCatalogId = this.catalogs[0].Id;
            }
            // If previously selected catalog was deleted, fall back to first
            if (
                this.selectedCatalogId &&
                !this.catalogs.find((c) => c.Id === this.selectedCatalogId)
            ) {
                this.selectedCatalogId =
                    this.catalogs.length > 0 ? this.catalogs[0].Id : '';
            }
        }
        if (result.error) {
            this.showError('Error loading catalogs', result.error);
        }
    }

    // ─── Wire: getTopicsWithNotebooks ──────────────────────
    @wire(getTopicsWithNotebooks, { catalogId: '$selectedCatalogId' })
    wiredTopics(result) {
        this._wiredTopicsResult = result;
        if (result.data) {
            this.topics = result.data;
        }
        if (result.error) {
            this.topics = [];
        }
    }

    // ─── Computed properties ───────────────────────────────
    get hasTopics() {
        return this.topics && this.topics.length > 0;
    }

    get catalogOptions() {
        return this.catalogs.map((c) => ({
            label: c.Title__c,
            value: c.Id
        }));
    }

    get topicOptions() {
        return this.topics.map((t) => ({
            label: t.Title__c,
            value: t.Id
        }));
    }

    // ═══════════════════════════════════════════════════════
    // CATALOG CRUD
    // ═══════════════════════════════════════════════════════

    handleSelectCatalog(event) {
        this.selectedCatalogId = event.detail.catalogId;
    }

    handleAddCatalog() {
        this.catalogModalHeader = 'New Catalog';
        this.catalogModalTitle = '';
        this.catalogModalId = null;
        this.catalogModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="catalog-modal"]').open();
    }

    handleEditCatalog(event) {
        this.catalogModalHeader = 'Edit Catalog';
        this.catalogModalTitle = event.detail.catalogTitle;
        this.catalogModalId = event.detail.catalogId;
        this.catalogModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="catalog-modal"]').open();
    }

    handleCatalogTitleChange(event) {
        this.catalogModalTitle = event.target.value;
    }

    async handleCatalogConfirm() {
        if (!this.catalogModalTitle || !this.catalogModalTitle.trim()) {
            this.catalogModalError = 'Title is required.';
            return;
        }
        try {
            const resultId = await upsertCatalog({
                catalogId: this.catalogModalId,
                title: this.catalogModalTitle.trim()
            });
            this.template
                .querySelector('c-lwc-modal[data-id="catalog-modal"]')
                .close();
            this.showSuccess(
                this.catalogModalId ? 'Catalog updated' : 'Catalog created'
            );
            // Select the newly created catalog
            if (!this.catalogModalId) {
                this.selectedCatalogId = resultId;
            }
            await refreshApex(this._wiredCatalogsResult);
            await refreshApex(this._wiredTopicsResult);
        } catch (error) {
            this.catalogModalError = this.reduceError(error);
        }
    }

    handleDeleteCatalog(event) {
        this.deleteTarget = {
            type: 'catalog',
            id: event.detail.catalogId,
            title: event.detail.catalogTitle
        };
        this.template
            .querySelector('c-nsf-confirmation-modal[data-id="delete-catalog"]')
            .open();
    }

    async handleConfirmDeleteCatalog() {
        try {
            await deleteCatalog({ catalogId: this.deleteTarget.id });
            this.showSuccess('Catalog deleted');
            if (this.selectedCatalogId === this.deleteTarget.id) {
                this.selectedCatalogId = '';
            }
            await refreshApex(this._wiredCatalogsResult);
        } catch (error) {
            this.showError('Delete failed', error);
        }
    }

    // ═══════════════════════════════════════════════════════
    // TOPIC CRUD
    // ═══════════════════════════════════════════════════════

    handleAddTopic() {
        this.topicModalHeader = 'New Topic';
        this.topicModalTitle = '';
        this.topicModalId = null;
        this.topicModalCatalogId = this.selectedCatalogId;
        this.topicModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="topic-modal"]').open();
    }

    handleAddTopicKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleAddTopic();
        }
    }

    handleEditTopic(event) {
        this.topicModalHeader = 'Edit Topic';
        this.topicModalTitle = event.detail.topicTitle;
        this.topicModalId = event.detail.topicId;
        this.topicModalCatalogId = this.selectedCatalogId;
        this.topicModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="topic-modal"]').open();
    }

    handleTopicTitleChange(event) {
        this.topicModalTitle = event.target.value;
    }

    handleTopicCatalogChange(event) {
        this.topicModalCatalogId = event.detail.value;
    }

    async handleTopicConfirm() {
        if (!this.topicModalTitle || !this.topicModalTitle.trim()) {
            this.topicModalError = 'Title is required.';
            return;
        }
        if (!this.topicModalCatalogId) {
            this.topicModalError = 'Please select a catalog.';
            return;
        }
        try {
            await upsertTopic({
                topicId: this.topicModalId,
                title: this.topicModalTitle.trim(),
                catalogId: this.topicModalCatalogId
            });
            this.template
                .querySelector('c-lwc-modal[data-id="topic-modal"]')
                .close();
            this.showSuccess(
                this.topicModalId ? 'Topic updated' : 'Topic created'
            );
            await refreshApex(this._wiredTopicsResult);
        } catch (error) {
            this.topicModalError = this.reduceError(error);
        }
    }

    handleDeleteTopic(event) {
        this.deleteTarget = {
            type: 'topic',
            id: event.detail.topicId,
            title: event.detail.topicTitle
        };
        this.template
            .querySelector('c-nsf-confirmation-modal[data-id="delete-topic"]')
            .open();
    }

    async handleConfirmDeleteTopic() {
        try {
            await deleteTopic({ topicId: this.deleteTarget.id });
            this.showSuccess('Topic deleted');
            await refreshApex(this._wiredTopicsResult);
        } catch (error) {
            this.showError('Delete failed', error);
        }
    }

    // ═══════════════════════════════════════════════════════
    // NOTEBOOK CRUD
    // ═══════════════════════════════════════════════════════

    handleAddNotebook(event) {
        this.notebookModalHeader = 'New Notebook';
        this.notebookModalTitle = '';
        this.notebookModalId = null;
        this.notebookModalTopicId = event.detail.topicId;
        this.notebookModalError = '';
        this.template
            .querySelector('c-lwc-modal[data-id="notebook-modal"]')
            .open();
    }

    handleEditNotebook(event) {
        this.notebookModalHeader = 'Edit Notebook';
        this.notebookModalTitle = event.detail.notebookTitle;
        this.notebookModalId = event.detail.notebookId;
        this.notebookModalTopicId = event.detail.topicId;
        this.notebookModalError = '';
        this.template
            .querySelector('c-lwc-modal[data-id="notebook-modal"]')
            .open();
    }

    handleNotebookTitleChange(event) {
        this.notebookModalTitle = event.target.value;
    }

    handleNotebookTopicChange(event) {
        this.notebookModalTopicId = event.detail.value;
    }

    async handleNotebookConfirm() {
        if (!this.notebookModalTitle || !this.notebookModalTitle.trim()) {
            this.notebookModalError = 'Title is required.';
            return;
        }
        if (!this.notebookModalTopicId) {
            this.notebookModalError = 'Please select a topic.';
            return;
        }
        try {
            await upsertNotebook({
                notebookId: this.notebookModalId,
                title: this.notebookModalTitle.trim(),
                topicId: this.notebookModalTopicId
            });
            this.template
                .querySelector('c-lwc-modal[data-id="notebook-modal"]')
                .close();
            this.showSuccess(
                this.notebookModalId ? 'Notebook updated' : 'Notebook created'
            );
            await refreshApex(this._wiredTopicsResult);
        } catch (error) {
            this.notebookModalError = this.reduceError(error);
        }
    }

    handleDeleteNotebook(event) {
        this.deleteTarget = {
            type: 'notebook',
            id: event.detail.notebookId,
            title: event.detail.notebookTitle
        };
        this.template
            .querySelector(
                'c-nsf-confirmation-modal[data-id="delete-notebook"]'
            )
            .open();
    }

    async handleConfirmDeleteNotebook() {
        try {
            await deleteNotebook({ notebookId: this.deleteTarget.id });
            this.showSuccess('Notebook deleted');
            await refreshApex(this._wiredTopicsResult);
        } catch (error) {
            this.showError('Delete failed', error);
        }
    }

    // ═══════════════════════════════════════════════════════
    // NOTEBOOK NAVIGATION
    // ═══════════════════════════════════════════════════════

    handleOpenNotebook(event) {
        const { notebookId, notebookTitle } = event.detail;

        if (this.isConsole) {
            // Console app → open each notebook in its own workspace tab.
            // Using standard__component pageReference so each unique
            // c__notebookId produces a distinct URL (/lightning/cmp/...)
            // and the Console creates a separate tab per notebook.
            openTab({
                pageReference: {
                    type: 'standard__component',
                    attributes: {
                        componentName: 'c__nsfNotebookContainer'
                    },
                    state: {
                        c__notebookId: notebookId,
                        c__notebookTitle: notebookTitle
                    }
                },
                label: notebookTitle || 'Notebook',
                icon: 'standard:note',
                iconAlt: 'Notebook',
                focus: true
            }).catch((err) => {
                console.error('Error opening workspace tab', err);
            });
        } else {
            // Standard app fallback → navigate to nav item page in-place
            this[NavigationMixin.Navigate]({
                type: 'standard__navItemPage',
                attributes: {
                    apiName: 'NSF_Notebook_View'
                },
                state: {
                    c__notebookId: notebookId,
                    c__notebookTitle: notebookTitle
                }
            });
        }
    }

    // ═══════════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════════

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

    get deleteMessage() {
        if (this.deleteTarget.type === 'notebook') {
            return `Are you sure you want to delete "${this.deleteTarget.title}"? All sections and content within this notebook will be permanently deleted.`;
        }
        return `Are you sure you want to delete "${this.deleteTarget.title}"?`;
    }

    get deleteCatalogMessage() {
        return `Are you sure you want to delete "${this.deleteTarget.title}"?`;
    }

    get deleteTopicMessage() {
        return `Are you sure you want to delete "${this.deleteTarget.title}"?`;
    }

    get deleteNotebookMessage() {
        return `Are you sure you want to delete "${this.deleteTarget.title}"? All sections and content within this notebook will be permanently deleted.`;
    }
}
