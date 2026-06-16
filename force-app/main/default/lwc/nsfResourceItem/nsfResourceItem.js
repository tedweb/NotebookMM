import { LightningElement, api, track } from 'lwc';

const TYPE_ICONS = {
    'Link': 'utility:new_window',
    'PDF': 'utility:pdf_ext',
    'Video': 'utility:video'
};

export default class NsfResourceItem extends LightningElement {
    @api resourceId;
    @api title;
    @api link;
    @api resourceType = 'Link';
    @api isBookmarked = false;
    @api sectionId;

    @track _hovered = false;

    get typeIcon() {
        return TYPE_ICONS[this.resourceType] || 'utility:new_window';
    }

    get bookmarkIcon() {
        return this.isBookmarked ? 'utility:favorite' : 'utility:favorite_alt';
    }

    get showActions() {
        return this._hovered;
    }

    handleMouseEnter() {
        this._hovered = true;
    }

    handleMouseLeave() {
        this._hovered = false;
    }

    handleOpenLink(event) {
        event.preventDefault();
        if (this.link) {
            window.open(this.link, '_blank');
        }
    }

    handleEdit() {
        this.dispatchEvent(new CustomEvent('editresource', {
            detail: {
                resourceId: this.resourceId,
                title: this.title,
                link: this.link,
                resourceType: this.resourceType,
                sectionId: this.sectionId
            },
            bubbles: true,
            composed: true
        }));
    }

    handleToggleBookmark() {
        this.dispatchEvent(new CustomEvent('togglebookmark', {
            detail: {
                resourceId: this.resourceId,
                sectionId: this.sectionId
            },
            bubbles: true,
            composed: true
        }));
    }

    handleDelete() {
        this.dispatchEvent(new CustomEvent('deleteresource', {
            detail: {
                resourceId: this.resourceId,
                title: this.title
            },
            bubbles: true,
            composed: true
        }));
    }
}
