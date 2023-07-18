/** @odoo-module **/

import { registry } from "@web/core/registry";

function patchPublicWidget() {
    const { PublicWidget } = odoo.loader.modules.get("@web/legacy/js/public/public_widget");
    const wysiwygLoader = odoo.loader.modules.get("@web_editor/js/frontend/loader")[Symbol.for('default')];


    PublicWidget.registry['public_user_editor_test'] = PublicWidget.Widget.extend({
        selector: 'textarea.o_public_user_editor_test_textarea',

        /**
         * @override
         */
        start: async function () {
            await this._super(...arguments);
            await wysiwygLoader.loadFromTextarea(this, this.el, {});
        },
    });
}


registry.category("web_tour.tours").add('public_user_editor', {
    test: true,
    steps: [{
    trigger: '.note-editable',
    run: function () {
        patchPublicWidget()
    }, // Simple check
}]});
