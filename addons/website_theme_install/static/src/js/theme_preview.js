odoo.define('website_theme_install.theme_preview', function (require) {
"use strict";

var KanbanController = require('web.KanbanController');
var Dialog = require('web.Dialog');
console.log('ok1');

var PostKanbanController = KanbanController.extend({
    events: _.extend({}, KanbanController.prototype.events, {
        'click .pokpokpok': '_onClickPreviewTheme',
    }),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Shows preview in modal
     *
     * @param {MouseEvent} ev
     */
    _onClickPreviewTheme: function (ev) {
        ev.stopPropagation();
        var $target = $(ev.currentTarget);
        debugger;
        var modal = new Dialog(this, {
            title: _t('Preview'),
            size: 'extra-large',
            $content: $("<iframe src='https://www.odoo.com'></iframe>"),
            // $content: $(qweb.render(
            //     'product_matrix.matrix', {
            //         header: infos.header,
            //         rows: infos.matrix,
            //     }
            // )),
            buttons: [],
        }).open();
    },
});

return PostKanbanController;

});
