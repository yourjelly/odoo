/** @odoo-module alias=web.FormControlPanel **/

import ControlPanel from "web.ControlPanel";

class FormControlPanel extends ControlPanel {
    save() {
        this.props.save();
    }
    discard() {
        this.props.discard();
    }
}
FormControlPanel.template = "web.FormControlPanel";
FormControlPanel.props = {
    ...ControlPanel.props,
    isNew: Boolean,
    isDirty: Boolean,
    hasErrors: Boolean,
    save: Function,
    discard: Function,
};

export default FormControlPanel;
