import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getResourcesByNotebook from '@salesforce/apex/NSF_ContentController.getResourcesByNotebook';
import upsertResource from '@salesforce/apex/NSF_ContentController.upsertResource';
import deleteResource from '@salesforce/apex/NSF_ContentController.deleteResource';
import toggleBookmark from '@salesforce/apex/NSF_BookmarkController.toggleBookmark';
import getBookmarkedItems from '@salesforce/apex/NSF_BookmarkController.getBookmarkedItems';
import getSectionsByNotebook from '@salesforce/apex/NSF_SectionController.getSectionsByNotebook';
import upsertSection from '@salesforce/apex/NSF_SectionController.upsertSection';
import deleteSection from '@salesforce/apex/NSF_SectionController.deleteSection';

export default class NsfResourceListView extends LightningElement {
    @api notebookId = '';
    @api hideAddSection = false;

    // ─── Wired data holders ────────────────────────────
    @track sectionsWithResources = [];
    @track bookmarkedResources = [];
    @track sectionOptions = [];
    _wiredResourcesResult;
    _wiredBookmarksResult;
    _wiredSectionsResult;

    // ─── Resource modal state ──────────────────────────
    resourceModalHeader = '';
    resourceModalTitle = '';
    resourceModalLink = '';
    resourceModalType = 'Link';
    resourceModalId = null;
    resourceModalSectionId = '';
    resourceModalError = '';

    // ─── Delete confirmation state ─────────────────────
    deleteTarget = {};

    // ═══════════════════════════════════════════════════
    // WIRES
    // ═══════════════════════════════════════════════════

    @wire(getResourcesByNotebook, { notebookId: '$notebookId' })
    wiredResources(result) {
        this._wiredResourcesResult = result;
        if (result.data) {
            this.sectionsWithResources = result.data.map(swi => ({
                sectionId: swi.section.Id,
                sectionName: swi.section.Name,
                title: swi.section.Title__c,
                hasResources: swi.items && swi.items.length > 0,
                resources: swi.items
                    ? swi.items.map(item => ({
                          id: item.recordId,
                          name: item.name,
                          title: item.title,
                          link: item.link,
                          type: item.itemType || 'Link',
                          isBookmarked: item.isBookmarked,
                          sectionId: swi.section.Id
                      }))
                    : []
            }));
        }
        if (result.error) {
            this.showError('Error loading resources', result.error);
        }
    }

    @wire(getBookmarkedItems, { notebookId: '$notebookId', mode: 'Resources' })
    wiredBookmarks(result) {
        this._wiredBookmarksResult = result;
        if (result.data) {
            this.bookmarkedResources = result.data.map(bm => ({
                id: bm.NSF_ResourceId__c,
                bookmarkRecordId: bm.Id,
                title: bm.NSF_ResourceId__r ? bm.NSF_ResourceId__r.Title__c : '',
                name: bm.NSF_ResourceId__r ? bm.NSF_ResourceId__r.Name : '',
                link: bm.NSF_ResourceId__r ? bm.NSF_ResourceId__r.Link__c : '',
                type: bm.NSF_ResourceId__r ? (bm.NSF_ResourceId__r.Type__c || 'Link') : 'Link',
                sectionId: bm.NSF_SectionId__c,
                sectionTitle: bm.NSF_SectionId__r
                    ? bm.NSF_SectionId__r.Title__c
                    : '',
                isBookmarked: true
            }));
        }
        if (result.error) {
            this.bookmarkedResources = [];
        }
    }

    @wire(getSectionsByNotebook, { notebookId: '$notebookId' })
    wiredSections(result) {
        this._wiredSectionsResult = result;
        if (result.data) {
            this.sectionOptions = result.data.map(s => ({
                label: s.Title__c,
                value: s.Id
            }));
        }
    }

    // ═══════════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════════

    get hasBookmarks() {
        return this.bookmarkedResources && this.bookmarkedResources.length > 0;
    }

    get hasSections() {
        return this.sectionsWithResources && this.sectionsWithResources.length > 0;
    }

    get deleteResourceMessage() {
        return 'Click OK to continue with deleting this resource. Otherwise, click Cancel.';
    }

    get deleteSectionMessage() {
        return 'Click OK to continue with deleting this section. All contents within the section will be deleted.';
    }

    get typeOptions() {
        return [
            { label: 'Link', value: 'Link' },
            { label: 'PDF', value: 'PDF' },
            { label: 'Video', value: 'Video' }
        ];
    }

    get isEditMode() {
        return !!this.resourceModalId;
    }

    // ═══════════════════════════════════════════════════
    // RESOURCE CRUD
    // ═══════════════════════════════════════════════════

    handleAddResourceToSection(event) {
        const sectionId = event.detail.sectionId;
        this.resourceModalHeader = 'Create Resource';
        this.resourceModalTitle = '';
        this.resourceModalLink = '';
        this.resourceModalType = 'Link';
        this.resourceModalId = null;
        this.resourceModalSectionId = sectionId;
        this.resourceModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="resource-modal"]').open();
    }

    handleEditResource(event) {
        const detail = event.detail;
        this.resourceModalHeader = 'Edit Resource';
        this.resourceModalTitle = detail.title;
        this.resourceModalLink = detail.link;
        this.resourceModalType = detail.resourceType || 'Link';
        this.resourceModalId = detail.resourceId;
        this.resourceModalSectionId = detail.sectionId;
        this.resourceModalError = '';
        this.template.querySelector('c-lwc-modal[data-id="resource-modal"]').open();
    }

    handleResourceTitleChange(event) {
        this.resourceModalTitle = event.target.value;
    }

    handleResourceLinkChange(event) {
        this.resourceModalLink = event.target.value;
    }

    handleResourceTypeChange(event) {
        this.resourceModalType = event.detail.value;
    }

    handleResourceSectionChange(event) {
        this.resourceModalSectionId = event.detail.value;
    }

    async handleResourceConfirm() {
        if (!this.resourceModalTitle || !this.resourceModalTitle.trim()) {
            this.resourceModalError = 'Title is required.';
            return;
        }
        if (!this.resourceModalLink || !this.resourceModalLink.trim()) {
            this.resourceModalError = 'Link is required.';
            return;
        }
        if (!this.resourceModalSectionId) {
            this.resourceModalError = 'Please select a section.';
            return;
        }
        try {
            await upsertResource({
                resourceId: this.resourceModalId,
                title: this.resourceModalTitle.trim(),
                link: this.resourceModalLink.trim(),
                resourceType: this.resourceModalType,
                sectionId: this.resourceModalSectionId
            });
            this.template
                .querySelector('c-lwc-modal[data-id="resource-modal"]')
                .close();
            this.showSuccess(
                this.resourceModalId ? 'Resource updated' : 'Resource created'
            );
            await this._refreshAll();
        } catch (error) {
            this.resourceModalError = this.reduceError(error);
        }
    }

    handleConfirmDeleteResource(event) {
        const detail = event.detail;
        this.deleteTarget = {
            type: 'resource',
            id: detail.resourceId,
            title: detail.title
        };
        this.template
            .querySelector('c-nsf-confirmation-modal[data-id="delete-resource"]')
            .open();
    }

    async handleDeleteResourceConfirmed() {
        try {
            await deleteResource({ resourceId: this.deleteTarget.id });
            this.showSuccess('Resource deleted');
            await this._refreshAll();
        } catch (error) {
            this.showError('Delete failed', error);
        }
    }

    // ═══════════════════════════════════════════════════
    // BOOKMARK TOGGLE
    // ═══════════════════════════════════════════════════

    async handleToggleBookmark(event) {
        const detail = event.detail;
        try {
            await toggleBookmark({
                recordId: detail.resourceId,
                recordType: 'Resource',
                sectionId: detail.sectionId
            });
            await this._refreshAll();
        } catch (error) {
            this.showError('Bookmark toggle failed', error);
        }
    }

    // ═══════════════════════════════════════════════════
    // SECTION CRUD
    // ═══════════════════════════════════════════════════

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
            .querySelector(
                'c-nsf-confirmation-modal[data-id="delete-section"]'
            )
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

    // ═══════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════

    async _refreshAll() {
        const promises = [];
        if (this._wiredResourcesResult) {
            promises.push(refreshApex(this._wiredResourcesResult));
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
