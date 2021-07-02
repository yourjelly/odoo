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
        rr.on('click', '.o_report_reception_unreserve', this._onClickUnreserve.bind(this));
        rr.on('click', '.o_report_reception_forecasted', this._onClickForecastReport.bind(this));
    },


    _switchButton: function(button) {
        let $button = $(button);
        if ($button.text().indexOf("Unreserve") >= 0) {
            $button.text("Reserve");
            $button.addClass("o_report_reception_reserve");
            $button.removeClass("o_report_reception_unreserve");
        } else {
            $button.text("Unreserve");
            $button.addClass("o_report_reception_unreserve");
            $button.removeClass("o_report_reception_reserve");
        }
    },

    /**
     * Reserve the specified move(s)
     *
     * @returns {Promise}
     */
    _onClickReserve: function(ev) {
        let quantities = [];  // incoming qty amounts to reserve
        let moveIds = [];
        let inIds = [];
        var nodeToReserve = []
        if (! ev.currentTarget.className.includes('o_reserve_all')) {
            nodeToReserve = [ev.currentTarget];
        } else {
            ev.target.style.display = 'none';
            if (ev.target.querySelectorAll('.o_reserve_all').length != 0) {
                ev.target.querySelectorAll('.o_reserve_all').style.display = 'none';
            }
            // Local reserve all
            var nodeToReserve = ev.target.querySelectorAll('.o_report_reception_reserve:not(o_reserve_all)');
            if (nodeToReserve.length == 0) {
                let parent = ev.target.closest('.o_report_reception_table');
                nodeToReserve = parent.querySelectorAll('.o_report_reception_reserve:not(.o_reserve_all)');
            }
        }

        nodeToReserve.forEach(node => {
            moveIds.push(parseInt(node.getAttribute('move-id')));
            quantities.push(parseFloat(node.getAttribute('qty')));
            inIds.push(JSON.parse(node.getAttribute('move-ins-ids')));
            this._switchButton(node);
        });

        return this._rpc({
            model: 'report.stock.report_reception',
            args: [false, moveIds, quantities, inIds],
            method: 'action_assign'
        })
    },

    /**
     * Unreserve the specified move
     *
     * @returns {Promise}
     */
     _onClickUnreserve: function(ev) {
        this._switchButton(ev.currentTarget);
        let quantity = parseFloat(ev.target.getAttribute('qty'));
        let modelId = parseInt(ev.target.getAttribute('move-id'));
        let inIds = JSON.parse("[" + ev.target.getAttribute('move-ins-ids') + "]");
        return this._rpc({
            model: 'report.stock.report_reception',
            args: [false, modelId, quantity, inIds[0]],
            method: 'action_unassign'
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
