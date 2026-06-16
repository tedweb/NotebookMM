import { LightningElement, api } from 'lwc';

export default class NsfSectionCard extends LightningElement {
    @api sectionTitle = '';
    @api sectionId = '';
    @api percentage = '';
    _showEditDelete = true;

    @api
    get showEditDelete() {
        return this._showEditDelete;
    }
    set showEditDelete(value) {
        this._showEditDelete = value;
    }
    @api actionButtonLabel = '';
    @api isBookmarkSection = false;

    _showHoverButtons = false;

    handleTitleMouseEnter() {
        if (this.showEditDelete && !this.isBookmarkSection) {
            this._showHoverButtons = true;
        }
    }

    handleTitleMouseLeave() {
        this._showHoverButtons = false;
    }

    get showHoverButtons() {
        return this._showHoverButtons;
    }

    get displayTitle() {
        if (this.percentage) {
            return `${this.sectionTitle} (${this.percentage})`;
        }
        return this.sectionTitle;
    }

    get titleClass() {
        return this.isBookmarkSection ? 'section-title bookmark-title' : 'section-title';
    }

    get cardClass() {
        return this.isBookmarkSection ? 'section-card bookmark-section' : 'section-card';
    }

    get showActionButton() {
        return this.actionButtonLabel && !this.isBookmarkSection;
    }

    handleEditSection() {
        this.dispatchEvent(
            new CustomEvent('editsection', {
                detail: { sectionId: this.sectionId, sectionTitle: this.sectionTitle }
            })
        );
    }

    handleDeleteSection() {
        this.dispatchEvent(
            new CustomEvent('deletesection', {
                detail: { sectionId: this.sectionId, sectionTitle: this.sectionTitle }
            })
        );
    }

    handleActionButton() {
        this.dispatchEvent(
            new CustomEvent('actionclick', {
                detail: { sectionId: this.sectionId }
            })
        );
    }
}
