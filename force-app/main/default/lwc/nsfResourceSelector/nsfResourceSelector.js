import { LightningElement, api, wire } from 'lwc';
import getResourcesForSelection from '@salesforce/apex/NSF_ContentController.getResourcesForSelection';

export default class NsfResourceSelector extends LightningElement {
    @api notebookId = '';
    @api excludeIds = [];
    @api label = 'Choose resource…';

    allResources = [];
    selectedValue = '';

    @wire(getResourcesForSelection, { notebookId: '$notebookId' })
    wiredResources({ data, error }) {
        if (data) {
            this.allResources = data;
        }
        if (error) {
            this.allResources = [];
        }
    }

    get options() {
        const excluded = new Set(this.excludeIds || []);
        return this.allResources
            .filter(r => !excluded.has(r.Id))
            .map(r => ({
                label: r.NSF_SectionId__r
                    ? `${r.Title__c} (${r.NSF_SectionId__r.Title__c})`
                    : r.Title__c,
                value: r.Id
            }));
    }

    get hasOptions() {
        return this.options.length > 0;
    }

    handleChange(event) {
        const selectedId = event.detail.value;
        const resource = this.allResources.find(r => r.Id === selectedId);
        if (resource) {
            this.dispatchEvent(
                new CustomEvent('resourceselect', {
                    detail: {
                        resourceId: resource.Id,
                        resourceTitle: resource.Title__c,
                        resourceLink: resource.Link__c,
                        resourceType: resource.Type__c
                    }
                })
            );
        }
        this.selectedValue = '';
    }
}
