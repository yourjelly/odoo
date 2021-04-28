/** @odoo-module alias=stock.ReceptionReport **/

import clientAction from 'report.client_action';
import core from 'web.core';

const ReceptionReport = clientAction.extend({
    /**
     * @override
     */
    init: function (parent, action, options) {
        this._super.apply(this, arguments);
        this.context = action.context;
        this.pickingIds = this.context.default_picking_ids;
        this.report_name = `stock.report_reception`
        this.report_url = `/report/html/${this.report_name}/?context=${JSON.stringify(this.context)}`;
        this._title = action.name;
    },

    /**
     * @override
     */
    on_attach_callback: function () {
        this._super();
        this.iframe.addEventListener("load",
            () => this._bindAdditionalActionHandlers(),
            { once: true }
        );
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Bind additional <button> action handlers
     */
    _bindAdditionalActionHandlers: function () {
        let rr = $(this.iframe).contents().find('.o_report_reception');
        rr.on('click', '.o_report_reception_reserve', this._onClickReserve.bind(this));
        rr.on('click', '.o_report_reception_forecasted', this._onClickForecastReport.bind(this));
    },

    /**
     * Reserve the specified move(s)
     *
     * @returns {Promise}
     */
    _onClickReserve: function(ev) {
        $(ev.currentTarget).hide()
        let quantities = []  // incoming qty amounts to reserve
        let modelIds = parseInt(ev.target.getAttribute('move-id'));
        if (isNaN(modelIds)) {
            // dealing with a "Reserve All"
            modelIds = JSON.parse("[" + ev.target.getAttribute('move-ids') + "]")[0];
            let alreadyReserved = [];  // quantity has previously been reserved
            for (const id of modelIds) {
                let button = $(this.iframe).contents().find("button.o_report_reception_reserve[move-id=" + id.toString() + "]");
                if ($(button).is(':visible')) {
                    quantities.push(parseFloat(button.attr('qty')));
                    button.hide();
                } else {
                    alreadyReserved.push(id);
                }
            }
            if (alreadyReserved.length > 0) {
                // remove moveIds so they don't show up in chatter pdf
                modelIds = modelIds.filter(item => !alreadyReserved.includes(item))
            }
            if ($(ev.target).hasClass("o_reserve_all")) {
                // hide sources' "Reserve All"
                $(this.iframe).contents().find("button.o_report_reception_reserve").hide();
            }
        } else {
            quantities.push(parseFloat(ev.target.getAttribute('qty')));
        }
        return this._rpc({
            model: 'report.stock.report_reception',
            args: [false, modelIds, quantities, this.pickingIds],
            method: 'action_assign'
        })
    },

    /**
     * Open the forecast report for the product of
     * the selected move
     */
    _onClickForecastReport: function(ev) {
        const model = ev.target.getAttribute('model');
        const modelId = parseInt(ev.target.getAttribute('move-id'));
        return this._rpc( {
            model,
            args: [[modelId]],
            method: 'action_product_forecast_report'
        }).then((action) => {
            return this.do_action(action);
        });
    },

});

core.action_registry.add('reception_report', ReceptionReport);

export default ReceptionReport
