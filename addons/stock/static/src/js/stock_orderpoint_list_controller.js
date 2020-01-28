odoo.define('stock.StockOrderpointListController', function (require) {
"use strict";

var core = require('web.core');
var ListController = require('web.ListController');

var qweb = core.qweb;


var StockOrderpointListController = ListController.extend({

    // -------------------------------------------------------------------------
    // Public
    // -------------------------------------------------------------------------

    init: function (parent, model, renderer, params) {
        this.context = renderer.state.getContext();
        return this._super.apply(this, arguments);
    },

    /**
     * @override
     */
    renderButtons: function ($node) {
        this._super.apply(this, arguments);
        var $buttons = $(qweb.render('StockOrderpoint.Buttons'));
        var $buttonRunScheduler = $buttons.find('.o_button_run_scheduler');
        var $buttonOrder = $buttons.find('.o_button_order');
        $buttonRunScheduler.on('click', this._onRunScheduler.bind(this));
        $buttonOrder.on('click', this._onReplenish.bind(this));
        $buttons.appendTo($node.find('.o_list_buttons'));
    },

    // -------------------------------------------------------------------------
    // Handlers
    // -------------------------------------------------------------------------

    _onReplenish: function () {
        this.model.replenish(this.getSelectedRecords());
    },

    _onRunScheduler: function () {
        this.do_action('stock.action_procurement_compute');
    },

    _onSelectionChanged: function (ev) {
        this._super(ev);
        var $buttonOrder = this.$el.find('.o_button_order');
        if (this.getSelectedIds().length === 0){
            $buttonOrder.removeClass('btn-primary').addClass('btn-secondary');
        } else {
            $buttonOrder.removeClass('btn-secondary').addClass('btn-primary');
        }
    },
});

return StockOrderpointListController;

});
