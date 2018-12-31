odoo.define('web_editor.wysiwyg.plugin.HelpDialog', function (require) {
'use strict';

var Plugins = require('web_editor.wysiwyg.plugins');
var registry = require('web_editor.wysiwyg.plugin.registry');

/**
 * Allows to customize link content and style.
 */
var HelpDialog = Plugins.helpDialog.extend({
    /**
     * Restore the hidden close button.
     */
    showHelpDialog: function () {
        return this._super().then(function () {
            this.$dialog.find('button.close span').attr('aria-hidden', 'false');
        }.bind(this));
    },
});

registry.add('helpDialog', HelpDialog);

return {HelpDialog: HelpDialog};
});
