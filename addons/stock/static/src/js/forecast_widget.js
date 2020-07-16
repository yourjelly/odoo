odoo.define('stock.forecast_widget', function (require) {
'use strict';

const basicFields = require('web.basic_fields');
const fieldRegistry = require('web.field_registry');
const core = require('web.core');
const QWeb = core.qweb;


const ForecastWidgetField = basicFields.FieldFloat.extend({
    _render: function () {
        const data = this.record.data;
        const fieldExpectedDate = this.nodeOptions.date_expected;
        const fieldExpectedQuantity = this.nodeOptions.qty_expected;
        const forecastedDate = this.value;
        const expectedDate = data[fieldExpectedDate];
        const expectedQuantity = data[fieldExpectedQuantity];
        const reservedAvailability = data.reserved_availability;

        let color = 'orange';
        if (!forecastedDate) {
            this.formatType = 'float';
            this.value = reservedAvailability;
            if (this.value == expectedQuantity) {
                color = false;
            }
        } else {
            if (forecastedDate > expectedDate) {
                color = 'red';
            }
        }
        // Render the value as how it must be rended.
        this._super(...arguments);

        let text = this.$el.text();
        if (forecastedDate) {
            text = `Exp ${text}`;
        }
        this.$el.html(QWeb.render('stock.forecastWidget', {
            color: color,
            value: text,
        }));
        this.$el.on('click', this._onOpenReport.bind(this));
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Opens the Forecast Report for the `stock.move` product.
     *
     * @param {MouseEvent} ev
     */
    _onOpenReport: function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        const productId = this.recordData.product_id.res_id;
        const resModel = 'product.product';
        this._rpc({
            model: resModel,
            method: 'action_product_forecast_report',
            args: [productId],
        }).then(action => {
            action.context = {
                active_model: resModel,
                active_id: productId,
            };
            this.do_action(action);
        });
    },
});

fieldRegistry.add('forecast_widget', ForecastWidgetField);

return ForecastWidgetField;
});
