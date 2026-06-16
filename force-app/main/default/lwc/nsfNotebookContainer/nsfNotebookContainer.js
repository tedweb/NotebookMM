import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';

export default class NsfNotebookContainer extends LightningElement {
    @track notebookId = '';
    @track notebookTitle = '';
    @track activeMode = 'Resources'; // default mode

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        if (pageRef && pageRef.state) {
            this.notebookId = pageRef.state.c__notebookId || '';
            this.notebookTitle = pageRef.state.c__notebookTitle || '';
        }
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

    handleModeChange(event) {
        this.activeMode = event.detail.mode;
    }
}
