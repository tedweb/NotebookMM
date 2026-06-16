import { LightningElement, api, wire, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { refreshApex } from '@salesforce/apex';
import getNotesByNotebook from '@salesforce/apex/NSF_ContentController.getNotesByNotebook';
import upsertNote from '@salesforce/apex/NSF_ContentController.upsertNote';
import deleteNote from '@salesforce/apex/NSF_ContentController.deleteNote';
import toggleBookmark from '@salesforce/apex/NSF_BookmarkController.toggleBookmark';
import getBookmarkedItems from '@salesforce/apex/NSF_BookmarkController.getBookmarkedItems';
import getSectionsByNotebook from '@salesforce/apex/NSF_SectionController.getSectionsByNotebook';
import upsertSection from '@salesforce/apex/NSF_SectionController.upsertSection';
import deleteSection from '@salesforce/apex/NSF_SectionController.deleteSection';

export default class NsfNoteListView extends LightningElement {
    @api notebookId = '';

    // ─── Wired data holders ────────────────────────────
    @track sectionsWithNotes = [];
    @track bookmarkedNotes = [];
    @track sectionOptions = [];
    _wiredNotesResult;
    _wiredBookmarksResult;
    _wiredSectionsResult;

    // ─── Note modal state ──────────────────────────────
    noteModalHeader = '';
    noteModalTitle = '';
    noteModalId = null;
    noteModalSectionId = '';
    noteModalError = '';
    _navigateToDetailOnCreate = false;

    // ─── Section modal state ───────────────────────────
    sectionModalHeader = '';
    sectionModalTitle = '';
    sectionModalId = null;
    sectionModalError = '';

    // ─── Delete confirmation state ─────────────────────
    deleteTarget = {};

    // ─── Detail view navigation ────────────────────────
    showDetailView = false;
    detailNoteId = '';

    // ─── Hover tracking ────────────────────────────────
    _hoveredNoteId = null;

    // ═══════════════════════════════════════════════════
    // WIRES
    // ═══════════════════════════════════════════════════

    @wire(getNotesByNotebook, { notebookId: '$notebookId' })
    wiredNotes(result) {
        this._wiredNotesResult = result;
        if (result.data) {
            this.sectionsWithNotes = result.data.map(swi => ({
                sectionId: swi.section.Id,
                sectionName: swi.section.Name,
                title: swi.section.Title__c,
                hasNotes: swi.items && swi.items.length > 0,
                notes: swi.items
                    ? swi.items.map(item => ({
                          id: item.recordId,
                          name: item.name,
                          title: item.title,
                          isBookmarked: item.isBookmarked,
                          sectionId: swi.section.Id,
                          bookmarkIcon: item.isBookmarked
                              ? 'utility:favorite'
                              : 'utility:favorite_alt',
                          showEdit: false
                      }))
                    : []
            }));
        }
        if (result.error) {
            this.showError('Error loading notes', result.error);
        }
    }

    @wire(getBookmarkedItems, { notebookId: '$notebookId', mode: 'Notes' })
    wiredBookmarks(result) {
        this._wiredBookmarksResult = result;
        if (result.data) {
            this.bookmarkedNotes = result.data.map(bm => ({
                id: bm.NSF_NoteId__c,
                bookmarkRecordId: bm.Id,
                title: bm.NSF_NoteId__r ? bm.NSF_NoteId__r.Title__c : '',
                name: bm.NSF_NoteId__r ? bm.NSF_NoteId__r.Name : '',
                sectionId: bm.NSF_SectionId__c,
                sectionTitle: bm.NSF_SectionId__r
                    ? bm.NSF_SectionId__r.Title__c
                    : '',
                isBookmarked: true,
                bookmarkIcon: 'utility:favorite',
                showEdit: false
            }));
        }
        if (result.error) {
            this.bookmarkedNotes = [];
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
        return this.bookmarkedNotes && this.bookmarkedNotes.length > 0;
    }

    get hasSections() {
        return this.sectionsWithNotes && this.sectionsWithNotes.length > 0;
    }

    get deleteNoteMessage() {
        return `Click OK to continue with deleting this note. Otherwise, click Cancel.`;
    }

    get deleteSectionMessage() {
        return `Click OK to continue with deleting this section. All contents within the section will be deleted.`;
    }

    // ═══════════════════════════════════════════════════
    // NOTE ITEM INTERACTIONS
    // ═══════════════════════════════════════════════════

    handleNoteMouseEnter(event) {
        const noteId = event.currentTarget.dataset.noteId;
        this._hoveredNoteId = noteId;
        this._updateNoteHoverState();
    }

    handleNoteMouseLeave() {
        this._hoveredNoteId = null;
        this._updateNoteHoverState();
    }

    _updateNoteHoverState() {
        this.sectionsWithNotes = this.sectionsWithNotes.map(section => ({
            ...section,
            notes: section.notes.map(note => ({
                ...note,
                showEdit: note.id === this._hoveredNoteId
            }))
        }));
        this.bookmarkedNotes = this.bookmarkedNotes.map(note => ({
            ...note,
            showEdit: note.id === this._hoveredNoteId
        }));
    }

    handleOpenNote(event) {
        event.preventDefault();
        const noteId = event.currentTarget.dataset.noteId;
        this.detailNoteId = noteId;
        this.showDetailView = true;
    }

    // ═══════════════════════════════════════════════════
    // NOTE CRUD
    // ═══════════════════════════════════════════════════

    handleAddNoteToSection(event) {
        const sectionId = event.detail.sectionId;
        this.noteModalHeader = 'Create Note';
        this.noteModalTitle = '';
        this.noteModalId = null;
        this.noteModalSectionId = sectionId;
        this.noteModalError = '';
        this._navigateToDetailOnCreate = true;
        this.template.querySelector('c-lwc-modal[data-id="note-modal"]').open();
    }

    handleEditNote(event) {
        event.stopPropagation();
        const noteId = event.currentTarget.dataset.noteId;
        const noteTitle = event.currentTarget.dataset.noteTitle;
        const sectionId = event.currentTarget.dataset.sectionId;
        this.noteModalHeader = 'Edit Note';
        this.noteModalTitle = noteTitle;
        this.noteModalId = noteId;
        this.noteModalSectionId = sectionId;
        this.noteModalError = '';
        this._navigateToDetailOnCreate = false;
        this.template.querySelector('c-lwc-modal[data-id="note-modal"]').open();
    }

    handleNoteTitleChange(event) {
        this.noteModalTitle = event.target.value;
    }

    handleNoteSectionChange(event) {
        this.noteModalSectionId = event.detail.value;
    }

    async handleNoteConfirm() {
        if (!this.noteModalTitle || !this.noteModalTitle.trim()) {
            this.noteModalError = 'Title is required.';
            return;
        }
        if (!this.noteModalSectionId) {
            this.noteModalError = 'Please select a section.';
            return;
        }
        try {
            const resultId = await upsertNote({
                noteId: this.noteModalId,
                title: this.noteModalTitle.trim(),
                sectionId: this.noteModalSectionId
            });
            this.template
                .querySelector('c-lwc-modal[data-id="note-modal"]')
                .close();
            this.showSuccess(
                this.noteModalId ? 'Note updated' : 'Note created'
            );
            await this._refreshAll();

            // Navigate to detail view for newly created notes
            if (!this.noteModalId && this._navigateToDetailOnCreate) {
                this.detailNoteId = resultId;
                this.showDetailView = true;
            }
        } catch (error) {
            this.noteModalError = this.reduceError(error);
        }
    }

    handleDeleteNote(event) {
        event.stopPropagation();
        const noteId = event.currentTarget.dataset.noteId;
        const noteTitle = event.currentTarget.dataset.noteTitle;
        this.deleteTarget = {
            type: 'note',
            id: noteId,
            title: noteTitle
        };
        this.template
            .querySelector('c-nsf-confirmation-modal[data-id="delete-note"]')
            .open();
    }

    async handleConfirmDeleteNote() {
        try {
            await deleteNote({ noteId: this.deleteTarget.id });
            this.showSuccess('Note deleted');
            await this._refreshAll();
        } catch (error) {
            this.showError('Delete failed', error);
        }
    }

    // ═══════════════════════════════════════════════════
    // BOOKMARK TOGGLE
    // ═══════════════════════════════════════════════════

    async handleToggleBookmark(event) {
        event.stopPropagation();
        const noteId = event.currentTarget.dataset.noteId;
        const sectionId = event.currentTarget.dataset.sectionId;
        try {
            await toggleBookmark({
                recordId: noteId,
                recordType: 'Note',
                sectionId: sectionId
            });
            await this._refreshAll();
        } catch (error) {
            this.showError('Bookmark toggle failed', error);
        }
    }

    // ═══════════════════════════════════════════════════
    // SECTION CRUD
    // ═══════════════════════════════════════════════════

    handleAddSection() {
        this.sectionModalHeader = 'Create Section';
        this.sectionModalTitle = '';
        this.sectionModalId = null;
        this.sectionModalError = '';
        this.template
            .querySelector('c-lwc-modal[data-id="section-modal"]')
            .open();
    }

    handleEditSection(event) {
        this.sectionModalHeader = 'Edit Section';
        this.sectionModalTitle = event.detail.sectionTitle;
        this.sectionModalId = event.detail.sectionId;
        this.sectionModalError = '';
        this.template
            .querySelector('c-lwc-modal[data-id="section-modal"]')
            .open();
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
            this.template
                .querySelector('c-lwc-modal[data-id="section-modal"]')
                .close();
            this.showSuccess(
                this.sectionModalId ? 'Section updated' : 'Section created'
            );
            await this._refreshAll();
        } catch (error) {
            this.sectionModalError = this.reduceError(error);
        }
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
    // DETAIL VIEW NAVIGATION
    // ═══════════════════════════════════════════════════

    async handleCloseDetail() {
        this.showDetailView = false;
        this.detailNoteId = '';
        await this._refreshAll();
    }

    // ═══════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════

    async _refreshAll() {
        const promises = [];
        if (this._wiredNotesResult) {
            promises.push(refreshApex(this._wiredNotesResult));
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
