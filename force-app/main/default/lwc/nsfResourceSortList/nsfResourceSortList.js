import { LightningElement, api } from 'lwc';

export default class NsfResourceSortList extends LightningElement {
    _resources = [];
    _selectedIndex = -1;

    @api
    get resources() {
        return this._resources;
    }
    set resources(value) {
        this._resources = (value || []).map((r, idx) => ({
            ...r,
            index: idx,
            isSelected: idx === this._selectedIndex,
            rowClass: idx === this._selectedIndex
                ? 'resource-row resource-row-selected'
                : 'resource-row'
        }));
    }

    get hasResources() {
        return this._resources.length > 0;
    }

    get canMoveUp() {
        return this._selectedIndex > 0;
    }

    get canMoveDown() {
        return (
            this._selectedIndex >= 0 &&
            this._selectedIndex < this._resources.length - 1
        );
    }

    handleSelectRow(event) {
        const idx = parseInt(event.currentTarget.dataset.index, 10);
        this._selectedIndex = idx;
        this._refreshRows();
    }

    handleMoveUp() {
        if (!this.canMoveUp) return;
        const items = this._getRawList();
        const i = this._selectedIndex;
        [items[i - 1], items[i]] = [items[i], items[i - 1]];
        this._selectedIndex = i - 1;
        this._emitReorder(items);
    }

    handleMoveDown() {
        if (!this.canMoveDown) return;
        const items = this._getRawList();
        const i = this._selectedIndex;
        [items[i], items[i + 1]] = [items[i + 1], items[i]];
        this._selectedIndex = i + 1;
        this._emitReorder(items);
    }

    handleRemove(event) {
        const resourceId = event.currentTarget.dataset.id;
        this._selectedIndex = -1;
        this.dispatchEvent(
            new CustomEvent('remove', { detail: { resourceId } })
        );
    }

    _getRawList() {
        return this._resources.map(r => ({
            id: r.id,
            title: r.title,
            link: r.link,
            type: r.type
        }));
    }

    _emitReorder(items) {
        this.dispatchEvent(
            new CustomEvent('reorder', { detail: { resources: items } })
        );
    }

    _refreshRows() {
        this._resources = this._resources.map((r, idx) => ({
            ...r,
            index: idx,
            isSelected: idx === this._selectedIndex,
            rowClass: idx === this._selectedIndex
                ? 'resource-row resource-row-selected'
                : 'resource-row'
        }));
    }
}
