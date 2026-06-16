import { LightningElement, api } from 'lwc';

export default class NsfTopicCard extends LightningElement {
    @api topic = {};

    _showTopicHover = false;

    get topicTitle() {
        return this.topic.Title__c || '';
    }

    get topicId() {
        return this.topic.Id || '';
    }

    get notebooks() {
        const raw = this.topic.Notebooks__r || [];
        return raw.map((nb) => ({
            id: nb.Id,
            title: nb.Title__c
        }));
    }

    get hasNotebooks() {
        return this.notebooks.length > 0;
    }

    get showTopicHover() {
        return this._showTopicHover;
    }

    handleTopicMouseEnter() {
        this._showTopicHover = true;
    }

    handleTopicMouseLeave() {
        this._showTopicHover = false;
    }

    handleEditTopic() {
        this.dispatchEvent(
            new CustomEvent('edittopic', {
                detail: {
                    topicId: this.topicId,
                    topicTitle: this.topicTitle
                }
            })
        );
    }

    handleDeleteTopic() {
        this.dispatchEvent(
            new CustomEvent('deletetopic', {
                detail: {
                    topicId: this.topicId,
                    topicTitle: this.topicTitle
                }
            })
        );
    }

    handleOpenNotebook(event) {
        const notebookId = event.currentTarget.dataset.id;
        const notebookTitle = event.currentTarget.dataset.title;
        this.dispatchEvent(
            new CustomEvent('opennotebook', {
                detail: { notebookId, notebookTitle }
            })
        );
    }

    handleEditNotebook(event) {
        event.stopPropagation();
        const notebookId = event.currentTarget.dataset.id;
        const notebookTitle = event.currentTarget.dataset.title;
        this.dispatchEvent(
            new CustomEvent('editnotebook', {
                detail: {
                    notebookId,
                    notebookTitle,
                    topicId: this.topicId
                }
            })
        );
    }

    handleDeleteNotebook(event) {
        event.stopPropagation();
        const notebookId = event.currentTarget.dataset.id;
        const notebookTitle = event.currentTarget.dataset.title;
        this.dispatchEvent(
            new CustomEvent('deletenotebook', {
                detail: { notebookId, notebookTitle }
            })
        );
    }

    handleAddNotebook() {
        this.dispatchEvent(
            new CustomEvent('addnotebook', {
                detail: { topicId: this.topicId }
            })
        );
    }
}
