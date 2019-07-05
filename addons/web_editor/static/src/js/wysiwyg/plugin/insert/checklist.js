odoo.define('web_editor.plugins.checklist', function () {
'use strict';

we3.addPlugin('Checklist', class extends we3.AbstractPlugin {
    static get autoInstall() {
        return ['List'];
    }
    constructor() {
        super(...arguments);
        this.dependencies = ['Arch'];
    }
    saveEditor() {
        var self = this;
        var max = 0;
        var ids = [];
        var lis = [];
        this.dependencies.Arch.getClonedArchNode(1).nextUntil(function (node) {
            if (!(node.nodeName === 'li')) {
                return;
            }
            lis.push(node);
            var checklistId = parseInt((node.attributes.id || '0').replace(/^checklist-id-/, ''));
            if (ids.indexOf(checklistId) === -1) {
                if (checklistId > max) {
                    max = checklistId;
                }
                ids.push(checklistId);
            }
        });

        lis.forEach(function (node) {
            node.attributes.set('id', 'checklist-id-' + (++max));
            self.dependencies.Arch.importUpdate(node.toJSON());
        });

        return super.saveEditor(...arguments);
    }
});

});