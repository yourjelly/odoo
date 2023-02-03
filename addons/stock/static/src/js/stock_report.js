odoo.define('stock.stock_report_new', function (require) {
"use strict";

var core = require('web.core');
var AbstractAction = require('web.AbstractAction');


const StockVariationReport = AbstractAction.extend({
    hasControlPanel: true,

    willStart: async function () {
        const reportsInfoPromise = this._rpc({
            model: 'stock.report.new',
            method: 'get_report_informations',
            args: [this.id],
        }).then(res => this.parse_report_informations(res));
        const parentPromise = this._super(...arguments);
        return Promise.all([reportsInfoPromise, parentPromise]);
    },
    parse_report_informations: function(values) {
        this.main_html = values.main_html;
        this.$searchview_buttons = $(values.searchview_html);
    },
    start: async function() {
        debugger;
        this.controlPanelProps.cp_content = {
            $searchview_buttons: this.$searchview_buttons,
        };
        await this._super(...arguments);
        this.render();
    },

    render: function() {
        this.render_template();
    },

    render_template: function() {
        // this.$('.o_content').html(this.search_template);
        this.$('.o_content').html(this.main_html);
    },

    // Updates the control panel and render the elements that have yet to be rendered
    update_cp: function() {
        var status = {
            cp_content: {
                $searchview_buttons: this.$searchview_buttons,
            },
        };
        return this.updateControlPanel(status);
    },

    reload: function() {
        var self = this;
        return this._rpc({
                model: 'stock.report.new',
                method: 'get_report_informations',
                args: [self.id],
                context: self.odoo_context,
            })
            .then(function(result){
                self.parse_report_informations(result);
                self.render();
                return self.update_cp();
            });
    },

});

core.action_registry.add('stock_report_new', StockVariationReport);
return(StockVariationReport);
});
