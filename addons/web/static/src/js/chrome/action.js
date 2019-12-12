odoo.define('web.Action', function (require) {
"use strict";

/**
 * This file defines the Action component which is instantiated by the
 * ActionManager.
 *
 * For the sake of backward compatibility, it uses an ComponentAdapter.
 */

const AbstractView = require('web.AbstractView');
const { ComponentAdapter } = require('web.OwlCompatibility');

class Action extends ComponentAdapter {
    async willStart() {
        if (this.props.Component.prototype instanceof AbstractView) {
            const action = this.props.action;
            const viewDescr = action.views.find(view => view.type === action.controller.viewType);
            const view = new viewDescr.View(viewDescr.fieldsView, action.controller.viewOptions);
            this.widget = await view.getController(this);
            return this.widget._widgetRenderAndInsert(() => {});
        }
        return super.willStart();
    }

    get widgetArgs() {
        return [this.props.action, this.props.options];
    }

    shouldUpdate() {
        return false;
    }

    // TODO: override destroy to keep actions in action stack alive?
}

return Action;

});
