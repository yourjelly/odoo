odoo.define('l10n_de_pos_res_cert.floor', function(require) {
    'use strict';

    const models = require('point_of_sale.models');
    const { uuidv4 } = require('l10n_de_pos_cert.utils');

    models.PosModel = models.PosModel.extend({
        isRestaurantCountryGermany() {
            return this.isCountryGermany() && this.config.iface_floorplan;
        },
    });

    const _super_order = models.Order.prototype;
    models.Order = models.Order.extend({
        _updateTimeStart(seconds) {
            if (!(this.pos.isRestaurantCountryGermany() && this.tssInformation.time_start.value)) {
                _super_order._updateTimeStart.apply(this, arguments);
            }
        },
        async createAndFinishOrderTransaction(lineDifference) {
            const transactionUuid = uuidv4();
            if (!this.pos.getApiToken()) {
                await this._authenticate();
            }

            const data = {
                'state': 'ACTIVE',
                'client_id': this.pos.getClientId()
            };
            return $.ajax({
                url: `${this.pos.getApiUrl()}tss/${this.pos.getTssId()}/tx/${transactionUuid}`,
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${this.pos.getApiToken()}` },
                data: JSON.stringify(data),
                contentType: 'application/json'
            }).then(() => {
                const data = {
                    'state': 'FINISHED',
                    'client_id': this.pos.getClientId(),
                    'schema': {
                        'standard_v1': {
                            'order': {
                                'line_items': lineDifference
                            }
                        }
                    }
                };
                return $.ajax({
                    url: `${this.pos.getApiUrl()}tss/${this.pos.getTssId()}/tx/${transactionUuid}?last_revision=1`,
                    method: 'PUT',
                    headers: {'Authorization': `Bearer ${this.pos.getApiToken()}`},
                    data: JSON.stringify(data),
                    contentType: 'application/json'
                });
            }).fail(async (error) => {
                if (error.status === 401) {  // Need to update the token
                    await this._authenticate();
                    return this.createAndFinishOrderTransaction(lineDifference);
                }
                // Return a Promise with rejected value for errors that are not handled here
                return Promise.reject(error);
            });
        },
        getLineItems() {
            const lineItems = [];
            this.get_orderlines().forEach(line => {
                if (line.quantity) {
                    const price = line.get_price_with_tax()/line.quantity;
                    let priceString = price.toString();
                    if (Math.floor(price) === price || priceString.split('.')[1].length < 2) {
                        priceString = price.toFixed(2);
                    }
                    lineItems.push({
                        'quantity': line.quantity,
                        'text': line.get_product().display_name,
                        'price_per_unit': priceString
                    })
                }
            })
            return lineItems;
        },
        async sendLineItems() {
            const lineItems = this.getLineItems();
            return await this.createAndFinishOrderTransaction(lineItems);
        },
        //@Override
        async cancelTransaction() {
            const lineItems = this.getLineItems();
            lineItems.forEach(line => {
                line.quantity = -1 * line.quantity;
            });
            await this.createAndFinishOrderTransaction(lineItems);
            return await _super_order.cancelTransaction.apply(this, arguments);
        }
    });
});
