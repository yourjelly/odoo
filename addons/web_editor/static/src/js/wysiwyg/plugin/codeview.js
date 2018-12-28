odoo.define('web_editor.wysiwyg.plugin.codeview', function (require) {
'use strict';

var Plugins = require('web_editor.wysiwyg.plugins');
var registry = require('web_editor.wysiwyg.plugin.registry');


var CodeviewPlugin = Plugins.codeview.extend({
    activate: function () {
        this._super();
        this.context.invoke('editor.hidePopover');
        this.context.invoke('editor.clearTarget');
    },
});

registry.add('codeview', CodeviewPlugin);

return CodeviewPlugin;

});
