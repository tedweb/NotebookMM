import { LightningElement, api } from 'lwc';

const MODES = [
    { value: 'Resources', label: 'Resources', icon: 'utility:link' },
    { value: 'Notes', label: 'Notes', icon: 'utility:note' },
    { value: 'Cards', label: 'Cards', icon: 'utility:layers' },
    { value: 'Exams', label: 'Exams', icon: 'utility:favorite' }
];

export default class NsfInteractionModeSelector extends LightningElement {
    @api activeMode = 'Resources';

    get modes() {
        return MODES.map(m => ({
            ...m,
            cssClass: 'mode-btn' + (m.value === this.activeMode ? ' mode-btn-active' : '')
        }));
    }

    handleModeClick(event) {
        const mode = event.currentTarget.dataset.mode;
        if (mode !== this.activeMode) {
            this.dispatchEvent(new CustomEvent('modechange', { detail: { mode } }));
        }
    }
}
