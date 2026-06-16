import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getNoteDetail from '@salesforce/apex/NSF_ContentController.getNoteDetail';
import saveNoteContent from '@salesforce/apex/NSF_ContentController.saveNoteContent';

export default class NsfNoteDetailView extends LightningElement {
    @api noteId = '';

    // ─── Note data ───────────────────────────────────
    noteTitle = '';
    noteSectionTitle = '';
    noteContent = '';
    _originalContent = '';
    isLoading = true;
    hasError = false;
    errorMessage = '';
    isSaving = false;

    // ═══════════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════════

    connectedCallback() {
        this._loadNote();
    }

    // ═══════════════════════════════════════════════════
    // DATA LOADING
    // ═══════════════════════════════════════════════════

    async _loadNote() {
        if (!this.noteId) {
            this.hasError = true;
            this.errorMessage = 'No note selected.';
            this.isLoading = false;
            return;
        }
        try {
            this.isLoading = true;
            this.hasError = false;
            const note = await getNoteDetail({ noteId: this.noteId });
            this.noteTitle = note.Title__c || '';
            this.noteSectionTitle = note.NSF_SectionId__r
                ? note.NSF_SectionId__r.Title__c
                : '';
            this.noteContent = note.Content__c || '';
            this._originalContent = this.noteContent;
        } catch (error) {
            this.hasError = true;
            this.errorMessage = this.reduceError(error);
        } finally {
            this.isLoading = false;
        }
    }

    // ═══════════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════════

    get isDirty() {
        return this.noteContent !== this._originalContent;
    }

    get saveButtonVariant() {
        return this.isDirty ? 'brand' : 'neutral';
    }

    get saveButtonLabel() {
        return this.isSaving ? 'Saving...' : 'Save';
    }

    get breadcrumb() {
        if (this.noteSectionTitle) {
            return `${this.noteSectionTitle} / ${this.noteTitle}`;
        }
        return this.noteTitle;
    }

    // ═══════════════════════════════════════════════════
    // EDITOR INTERACTIONS
    // ═══════════════════════════════════════════════════

    handleContentChange(event) {
        this.noteContent = event.target.value;
    }

    async handleSave() {
        if (!this.isDirty || this.isSaving) {
            return;
        }
        try {
            this.isSaving = true;
            await saveNoteContent({
                noteId: this.noteId,
                content: this.noteContent
            });
            this._originalContent = this.noteContent;
            this.showSuccess('Note saved');
        } catch (error) {
            this.showError('Save failed', error);
        } finally {
            this.isSaving = false;
        }
    }

    handleBack() {
        if (this.isDirty) {
            this.template
                .querySelector('c-nsf-confirmation-modal[data-id="unsaved-changes"]')
                .open();
        } else {
            this._fireClose();
        }
    }

    handleConfirmDiscard() {
        this._fireClose();
    }

    // ═══════════════════════════════════════════════════
    // KEYBOARD SHORTCUT
    // ═══════════════════════════════════════════════════

    handleKeyDown(event) {
        // Ctrl+S / Cmd+S to save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            this.handleSave();
        }
    }

    // ═══════════════════════════════════════════════════
    // HELPERS
    // ═══════════════════════════════════════════════════

    _fireClose() {
        this.dispatchEvent(new CustomEvent('close'));
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
