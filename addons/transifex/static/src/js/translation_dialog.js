odoo.define('transifex.TranslationDialog', function (require) {
"use strict";

var TranslationDialog = require('web.TranslationDialog');

TranslationDialog.include({

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Load the translation terms for the installed language, for the current model and res_id
     * @private
     */
    _loadTranslations: function () {
        return this._rpc({
            model: 'ir.translation',
            method: 'search_read',
            fields: ['lang', 'src', 'value', 'transifex_url'],
            domain: this.domain,
        });
    },
});
});
