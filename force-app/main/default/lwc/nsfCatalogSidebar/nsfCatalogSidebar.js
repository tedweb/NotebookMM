import { LightningElement, api } from 'lwc';

export default class NsfCatalogSidebar extends LightningElement {
    @api catalogs = [];
    @api selectedCatalogId = '';

    get catalogItems() {
        return this.catalogs.map((c) => ({
            id: c.Id,
            title: c.Title__c,
            itemClass:
                c.Id === this.selectedCatalogId
                    ? 'catalog-item selected'
                    : 'catalog-item',
            isSelected: c.Id === this.selectedCatalogId
        }));
    }

    get hasCatalogs() {
        return this.catalogs && this.catalogs.length > 0;
    }

    handleSelectCatalog(event) {
        const catalogId = event.currentTarget.dataset.id;
        this.dispatchEvent(
            new CustomEvent('selectcatalog', { detail: { catalogId } })
        );
    }

    handleAddCatalog() {
        this.dispatchEvent(new CustomEvent('addcatalog'));
    }

    handleAddCatalogKeydown(event) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleAddCatalog();
        }
    }

    handleEditCatalog(event) {
        event.stopPropagation();
        const catalogId = event.currentTarget.dataset.id;
        const catalogTitle = event.currentTarget.dataset.title;
        this.dispatchEvent(
            new CustomEvent('editcatalog', {
                detail: { catalogId, catalogTitle }
            })
        );
    }

    handleDeleteCatalog(event) {
        event.stopPropagation();
        const catalogId = event.currentTarget.dataset.id;
        const catalogTitle = event.currentTarget.dataset.title;
        this.dispatchEvent(
            new CustomEvent('deletecatalog', {
                detail: { catalogId, catalogTitle }
            })
        );
    }
}
