/** @odoo-module **/

import { ListRenderer } from "@web/views/list/list_renderer";
import { ViewButton } from "@web/views/view_button/view_button";


/**
 * The purpose of this override is to disable line buttons when the row is edited.
 *
 */

 export class SingletonListViewButton extends ViewButton {
    onClick() {
        const self = this;
        this.props.record.save({ stayInEdition: true }).then(() => {
            self.env.onClickViewButton({
                clickParams: self.clickParams,
                record: self.props.record,
            });
        });
    }
}

export class SingletonListRenderer extends ListRenderer {

    _disableRecordSelectors() {
        this._super.apply(this, arguments);
        var row = this._getRow(this._getRecordID(this.currentRow))[0];
        var lineButtons = row.querySelectorAll('button[name=action_set_inventory_quantity]');
        lineButtons.forEach(elem => elem.setAttribute('disabled', true));
    }

    /**
     * @private
     */
    _enableRecordSelectors() {
        this._super.apply(this, arguments);
        var lineButtons = this.el.querySelectorAll('button.disabled');
        lineButtons.forEach(elem => elem.removeAttribute('disabled'));
    }

}

SingletonListRenderer.components = { ...SingletonListRenderer.components, ViewButton: SingletonListViewButton };
