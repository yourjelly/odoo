odoo.define('web.ActionContainer', function (require) {
    "use strict";

    const { Component , hooks } = owl;

    const ActionAdapter = require('web.ActionAdapter');
    const OwlDialog = require('web.OwlDialog');

    class ActionContainer extends Component {
        constructor() {
            super(...arguments);
            this.actionRef = hooks.useRef('actionRef');
            this.dialogRef = hooks.useRef('dialogRef');
        }
        get actionManager() {
            return this.env.actionManager;
        }
        getActionDescriptors() {
            const descrName = this.props.dialog ? 'dialog' : 'main';
            return this.actionManager.activeDescriptors[descrName];
        }
        async willStart() {
            await super.willStart(...arguments);
            const hasDom = await this.actionManager.getActionPromise();
            if (hasDom === false) {
                this.destroy();
            }
        }
        mounted() {
            this._replaceDialogFooter();
        }
        patched() {
            this._replaceDialogFooter();
        }
        _replaceDialogFooter() {
            if (this.dialogRef.comp && this.actionRef.comp.widget) {
                const footer = this.dialogRef.comp.footerRef.el;
                footer.innerHTML = "";
                this.actionRef.comp.widget.renderButtons($(footer));
            }
        }
        _onDialogClosed() {
            // TODO: may be moved in dialogAction or action_adapter ?
            this.actionManager.dispatch('doAction', {type: 'ir.actions.act_window_close'});
        }
    }
    ActionContainer.template = 'web.ActionContainer';
    ActionContainer.components  = { ActionAdapter , OwlDialog };

    return {
        ActionContainer,
    };
});
