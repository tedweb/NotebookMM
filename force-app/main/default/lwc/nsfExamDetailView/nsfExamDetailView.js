import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import getExamsBySection from '@salesforce/apex/NSF_ContentController.getExamsBySection';
import deleteExam from '@salesforce/apex/NSF_ContentController.deleteExam';
import getLinkedResources from '@salesforce/apex/NSF_ContentController.getLinkedResources';
import getSectionsByNotebook from '@salesforce/apex/NSF_SectionController.getSectionsByNotebook';
import toggleBookmark from '@salesforce/apex/NSF_BookmarkController.toggleBookmark';
import isBookmarked from '@salesforce/apex/NSF_BookmarkController.isBookmarked';
import getBookmarkedItems from '@salesforce/apex/NSF_BookmarkController.getBookmarkedItems';

export default class NsfExamDetailView extends LightningElement {
    @api notebookId = '';
    @api sectionId = '';
    @api sectionTitle = '';

    // ─── State ────────────────────────────────────
    @track exams = [];
    @track sectionOptions = [];
    @track linkedResources = [];
    @track answers = [];
    currentIndex = 0;
    _selectedAnswerId = null;
    _isSubmitted = false;
    _isBookmarked = false;
    _showResources = false;
    _isLoading = true;

    // ─── Bookmark section handling ────────────────
    _isBookmarkSection = false;

    // ═══════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════

    connectedCallback() {
        this._isBookmarkSection = this.sectionId === '__bookmarks__';
        this.loadSections();
        this.loadExams();
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

    async loadExams() {
        this._isLoading = true;
        try {
            if (this._isBookmarkSection) {
                const bookmarks = await getBookmarkedItems({
                    notebookId: this.notebookId,
                    mode: 'Exams'
                });
                this.exams = (bookmarks || []).map(bm => ({
                    Id: bm.NSF_ExamId__c,
                    Question__c: bm.NSF_ExamId__r ? bm.NSF_ExamId__r.Question__c : '',
                    Explanation__c: '',
                    NSF_SectionId__c: bm.NSF_SectionId__c,
                    Answer_Candidates__r: []
                }));
            } else {
                const result = await getExamsBySection({
                    sectionId: this.sectionId
                });
                this.exams = result || [];
            }
            this.currentIndex = 0;
            this._resetAnswerState();
            if (this.exams.length > 0) {
                this._buildAnswers();
                await this._checkBookmark();
            }
        } catch (e) {
            this.exams = [];
        }
        this._isLoading = false;
    }

    async _checkBookmark() {
        if (!this.currentExam) return;
        try {
            this._isBookmarked = await isBookmarked({
                recordId: this.currentExam.Id,
                recordType: 'Exam'
            });
        } catch (e) {
            this._isBookmarked = false;
        }
    }

    async _loadLinkedResources() {
        if (!this.currentExam) return;
        try {
            this.linkedResources = await getLinkedResources({
                recordId: this.currentExam.Id,
                recordType: 'Exam'
            });
        } catch (e) {
            this.linkedResources = [];
        }
    }

    // ═══════════════════════════════════════════════
    // ANSWER STATE
    // ═══════════════════════════════════════════════

    _resetAnswerState() {
        this._selectedAnswerId = null;
        this._isSubmitted = false;
        this._showResources = false;
        this.linkedResources = [];
    }

    _buildAnswers() {
        const exam = this.currentExam;
        if (!exam) {
            this.answers = [];
            return;
        }
        const candidates = exam.Answer_Candidates__r || [];
        this.answers = candidates.map(a => {
            const isSelected = a.Id === this._selectedAnswerId;
            const isCorrect = a.Is_Correct__c === true;
            let optionClass = 'answer-option';
            let radioClass = 'answer-radio';
            let dotClass = 'answer-radio-dot';

            if (this._isSubmitted) {
                optionClass += ' answer-option-disabled';
                if (isCorrect) {
                    optionClass += ' answer-option-correct';
                    radioClass += ' answer-radio-correct';
                    dotClass += ' answer-radio-dot-correct';
                } else if (isSelected && !isCorrect) {
                    optionClass += ' answer-option-incorrect';
                    radioClass += ' answer-radio-incorrect';
                    dotClass += ' answer-radio-dot-incorrect';
                }
            } else if (isSelected) {
                optionClass += ' answer-option-selected';
                radioClass += ' answer-radio-selected';
            }

            return {
                id: a.Id,
                text: a.Possible_Answer__c || '',
                isSelected: isSelected,
                isCorrect: isCorrect,
                showDot: isSelected || (this._isSubmitted && isCorrect),
                optionClass: optionClass,
                radioClass: radioClass,
                dotClass: dotClass
            };
        });
    }

    // ═══════════════════════════════════════════════
    // COMPUTED
    // ═══════════════════════════════════════════════

    get currentExam() {
        return this.exams[this.currentIndex] || null;
    }

    get questionText() {
        return this.currentExam ? this.currentExam.Question__c || '' : '';
    }

    get explanationText() {
        return this.currentExam ? this.currentExam.Explanation__c || '' : '';
    }

    get hasExplanation() {
        return this._isSubmitted && !!this.explanationText;
    }

    get examIndexLabel() {
        if (!this.exams.length) return '';
        return `Question ${this.currentIndex + 1} of ${this.exams.length}`;
    }

    get hasExams() {
        return this.exams.length > 0;
    }

    get hasPrevious() {
        return this.currentIndex > 0;
    }

    get hasNext() {
        return this.currentIndex < this.exams.length - 1;
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

    get isSubmitted() {
        return this._isSubmitted;
    }

    get canSubmit() {
        return this._selectedAnswerId != null && !this._isSubmitted;
    }

    get disableSubmit() {
        return !this.canSubmit;
    }

    get isAnswerCorrect() {
        if (!this._isSubmitted || !this._selectedAnswerId) return false;
        const selected = this.answers.find(a => a.id === this._selectedAnswerId);
        return selected ? selected.isCorrect : false;
    }

    get resultBadgeClass() {
        return this.isAnswerCorrect
            ? 'result-badge result-correct'
            : 'result-badge result-incorrect';
    }

    get resultBadgeText() {
        return this.isAnswerCorrect ? '✓ Correct' : '✗ Incorrect';
    }

    get deleteExamMessage() {
        return 'Click OK to continue with deleting this question. Otherwise, click Cancel.';
    }

    // ═══════════════════════════════════════════════
    // ANSWER INTERACTIONS
    // ═══════════════════════════════════════════════

    handleSelectAnswer(event) {
        if (this._isSubmitted) return;
        const answerId = event.currentTarget.dataset.answerId;
        this._selectedAnswerId = answerId;
        this._buildAnswers();
    }

    handleSubmit() {
        if (!this.canSubmit) return;
        this._isSubmitted = true;
        this._buildAnswers();
    }

    // ═══════════════════════════════════════════════
    // NAVIGATION
    // ═══════════════════════════════════════════════

    async handlePrevious() {
        if (!this.hasPrevious) return;
        this._resetAnswerState();
        this.currentIndex--;
        this._buildAnswers();
        await this._checkBookmark();
    }

    async handleNext() {
        if (!this.hasNext) return;
        this._resetAnswerState();
        this.currentIndex++;
        this._buildAnswers();
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
        await this.loadExams();
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
        if (!this.currentExam) return;
        try {
            const result = await toggleBookmark({
                recordId: this.currentExam.Id,
                recordType: 'Exam',
                sectionId: this.currentExam.NSF_SectionId__c
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
                detail: { examId: null, sectionId: this.sectionId }
            })
        );
    }

    handleEdit() {
        if (!this.currentExam) return;
        this.dispatchEvent(
            new CustomEvent('edit', {
                detail: {
                    examId: this.currentExam.Id,
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
        if (!this.currentExam) return;
        this.template
            .querySelector('c-nsf-confirmation-modal[data-id="delete-exam"]')
            .open();
    }

    async handleConfirmDeleteExam() {
        try {
            await deleteExam({ examId: this.currentExam.Id });
            this.showSuccess('Question deleted');
            if (this.currentIndex >= this.exams.length - 1 && this.currentIndex > 0) {
                this.currentIndex--;
            }
            await this.loadExams();
        } catch (e) {
            this.showError('Delete failed', e);
        }
    }

    handleClose() {
        this.dispatchEvent(new CustomEvent('close'));
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
