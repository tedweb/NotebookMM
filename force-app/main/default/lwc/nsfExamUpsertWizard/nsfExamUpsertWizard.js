import { LightningElement, api, track } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import upsertExam from '@salesforce/apex/NSF_ContentController.upsertExam';
import getLinkedResources from '@salesforce/apex/NSF_ContentController.getLinkedResources';
import getExamsBySection from '@salesforce/apex/NSF_ContentController.getExamsBySection';

export default class NsfExamUpsertWizard extends LightningElement {
    @api notebookId = '';
    @api sectionId = '';
    @api examId = null;

    // ─── Wizard state ─────────────────────────────
    @track currentPage = 1; // 1=Question+Answers, 2=Resources
    @track questionText = '';
    @track explanationText = '';
    @track answerCandidates = [];
    @track selectedResources = [];
    _orderNum = null;
    _isLoading = false;
    _nextAnswerKey = 1;

    // ═══════════════════════════════════════════════
    // LIFECYCLE
    // ═══════════════════════════════════════════════

    connectedCallback() {
        if (this.examId) {
            this._loadExistingExam();
        } else {
            // Default: start with 3 blank answers
            this._initDefaultAnswers();
        }
    }

    // ═══════════════════════════════════════════════
    // DATA LOADING (edit mode)
    // ═══════════════════════════════════════════════

    _initDefaultAnswers() {
        this.answerCandidates = [];
        for (let i = 0; i < 3; i++) {
            this.answerCandidates.push({
                key: this._nextAnswerKey++,
                id: null,
                answer: '',
                isCorrect: i === 0
            });
        }
    }

    async _loadExistingExam() {
        this._isLoading = true;
        try {
            // Load exam data via section query
            const exams = await getExamsBySection({
                sectionId: this.sectionId
            });
            const exam = exams.find(e => e.Id === this.examId);
            if (exam) {
                this.questionText = exam.Question__c || '';
                this.explanationText = exam.Explanation__c || '';
                this._orderNum = exam.Order__c;

                const candidates = exam.Answer_Candidates__r || [];
                this.answerCandidates = candidates.map(a => ({
                    key: this._nextAnswerKey++,
                    id: a.Id,
                    answer: a.Possible_Answer__c || '',
                    isCorrect: a.Is_Correct__c === true
                }));

                // Ensure at least one is marked correct
                if (!this.answerCandidates.some(a => a.isCorrect) && this.answerCandidates.length > 0) {
                    this.answerCandidates[0].isCorrect = true;
                }
            }

            // Load linked resources
            const resources = await getLinkedResources({
                recordId: this.examId,
                recordType: 'Exam'
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

    get pageLabel() {
        if (this.currentPage === 1) return 'Question & Answers';
        return 'Supporting Resources';
    }

    get isEditing() {
        return !!this.examId;
    }

    get showBackButton() {
        return this.currentPage > 1;
    }

    get showNextButton() {
        return this.currentPage < 2;
    }

    get showSaveButton() {
        return this.currentPage === 2;
    }

    get isLoading() {
        return this._isLoading;
    }

    get excludeResourceIds() {
        return this.selectedResources.map(r => r.id);
    }

    get canAddAnswer() {
        return this.answerCandidates.length < 6;
    }

    get canRemoveAnswer() {
        return this.answerCandidates.length > 2;
    }

    get displayAnswers() {
        return this.answerCandidates.map((a, idx) => ({
            ...a,
            index: idx,
            label: `Answer ${idx + 1}`,
            rowClass: a.isCorrect ? 'answer-row answer-row-correct' : 'answer-row',
            showRemove: this.canRemoveAnswer
        }));
    }

    // ═══════════════════════════════════════════════
    // PAGE 1: QUESTION & ANSWERS
    // ═══════════════════════════════════════════════

    handleQuestionChange(event) {
        this.questionText = event.target.value;
    }

    handleExplanationChange(event) {
        this.explanationText = event.target.value;
    }

    handleAnswerTextChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const arr = [...this.answerCandidates];
        arr[idx] = { ...arr[idx], answer: event.target.value };
        this.answerCandidates = arr;
    }

    handleCorrectChange(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        // Set only this answer as correct
        this.answerCandidates = this.answerCandidates.map((a, i) => ({
            ...a,
            isCorrect: i === idx
        }));
    }

    handleAddAnswer() {
        if (!this.canAddAnswer) return;
        this.answerCandidates = [
            ...this.answerCandidates,
            {
                key: this._nextAnswerKey++,
                id: null,
                answer: '',
                isCorrect: false
            }
        ];
    }

    handleRemoveAnswer(event) {
        if (!this.canRemoveAnswer) return;
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        const removed = this.answerCandidates[idx];
        let arr = this.answerCandidates.filter((_, i) => i !== idx);
        // If the removed answer was the correct one, mark the first as correct
        if (removed.isCorrect && arr.length > 0) {
            arr[0] = { ...arr[0], isCorrect: true };
        }
        this.answerCandidates = arr;
    }

    // ═══════════════════════════════════════════════
    // PAGE 2: RESOURCES
    // ═══════════════════════════════════════════════

    handleResourceSelect(event) {
        const { resourceId, resourceTitle, resourceLink, resourceType } =
            event.detail;
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
        if (this.currentPage === 1) {
            // Validate question text
            if (!this.questionText.trim()) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Validation',
                        message: 'Please enter a question.',
                        variant: 'warning'
                    })
                );
                return;
            }
            // Validate at least 2 answers with text
            const filledAnswers = this.answerCandidates.filter(a => a.answer.trim());
            if (filledAnswers.length < 2) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Validation',
                        message: 'Please provide at least 2 answer options.',
                        variant: 'warning'
                    })
                );
                return;
            }
            // Validate one correct answer
            if (!this.answerCandidates.some(a => a.isCorrect)) {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Validation',
                        message: 'Please mark one answer as correct.',
                        variant: 'warning'
                    })
                );
                return;
            }
        }
        if (this.currentPage < 2) {
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
            // Build answers JSON: only non-empty answers
            const answersJson = JSON.stringify(
                this.answerCandidates
                    .filter(a => a.answer.trim())
                    .map(a => ({
                        answer: a.answer.trim(),
                        isCorrect: a.isCorrect
                    }))
            );

            await upsertExam({
                examId: this.examId,
                question: this.questionText.trim(),
                explanation: this.explanationText.trim(),
                orderNum: this._orderNum,
                sectionId: this.sectionId,
                answersJson: answersJson,
                resourceIds: resourceIds
            });
            this.dispatchEvent(
                new ShowToastEvent({
                    title: 'Success',
                    message: this.isEditing
                        ? 'Question updated'
                        : 'Question created',
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
