odoo.define('stock.availabilityWidget', function (require) {
"use strict";

const servicesMixin = require('web.ServicesMixin');
const ActionManager = require('web.ActionManager');
const widgetRegistryOwl = require('web.widgetRegistry');


class availabilityWidget extends owl.Component {
    /**
     * @override
     */
    constructor(parent, props) {
        super(...arguments);
        const parentRecordData = parent.props.record.data;
        const parentState = parentRecordData.state;
        const recordData = props.record.data;
        const productType = recordData.product_type;

        this.props.displayChartButton = productType === 'product' && !['draft', 'cancel'].includes(parentState);
        this.props.available = productType != 'product' || recordData.reserved_availability === recordData.product_uom_qty;
    }

    mounted() {
        const $button = $('button', this.el);
        const $tableHeader = $('th[data-name="availability"]');
        $tableHeader.text('Availability');
        $tableHeader.css('text-align', 'right');
        $button[0].addEventListener('click', this._onClickReport.bind(this));
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _openForecastedReport() {
        return this.rpc({
            model: 'stock.move',
            method: 'action_open_replenishment_report',
            args: [this.props.record.data.id],
        }).then((action) => {
            this.trigger('do-action', {action: action});
        });
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    _onClickReport(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        this._openForecastedReport();
    }
}

widgetRegistryOwl.add('availability', availabilityWidget);
});