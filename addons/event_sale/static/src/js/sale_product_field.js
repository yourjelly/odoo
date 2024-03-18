/** @odoo-module **/

import { patch } from "@web/core/utils/patch";
import { today, serializeDate } from "@web/core/l10n/dates";
import { SaleOrderLineProductField } from '@sale/js/sale_product_field';


patch(SaleOrderLineProductField.prototype, {

    async _fetchEventTicket(productId) {
        return await this.orm.searchRead(
            "event.event.ticket",
            [
                ['product_id', '=', productId],
                ['event_id.date_end', '>=', serializeDate(today())]
            ],
            ['event_id'],
        );
    },

    async _onProductUpdate() {
        const productId = this.props.record.data.product_id[0];
        super._onProductUpdate(...arguments);
        if (this.props.record.data.product_type === 'service') {
            const eventTicketExists = await this._fetchEventTicket(productId);
            if (eventTicketExists.length) {
                this._openEventConfigurator();
            }
        }
    },

    async _editLineConfiguration() {
        const productId = this.props.record.data.product_id[0];
        super._editLineConfiguration(...arguments);
        if (this.props.record.data.product_type === 'service') {
            const eventTicketExists = await this._fetchEventTicket(productId);
            if (eventTicketExists.length) {
                this._openEventConfigurator();
            }
        };
    },

    get isConfigurableLine() {
        return super.isConfigurableLine || this.props.record.data.product_type === 'service';
    },

    async _openEventConfigurator() {
        let actionContext = {
            'default_product_id': this.props.record.data.product_id[0],
        };
        if (this.props.record.data.event_id) {
            actionContext.default_event_id = this.props.record.data.event_id[0];
        }
        if (this.props.record.data.event_ticket_id) {
            actionContext.default_event_ticket_id = this.props.record.data.event_ticket_id[0];
        }
        this.action.doAction(
            'event_sale.event_configurator_action',
            {
                additionalContext: actionContext,
                onClose: async (closeInfo) => {
                    if (!closeInfo || closeInfo.special) {
                        // wizard popup closed or 'Cancel' button triggered
                        if (!this.props.record.data.event_ticket_id) {
                            // remove product if event configuration was cancelled.
                            this.props.record.update({
                                [this.props.name]: undefined,
                            });
                        }
                    } else {
                        const eventConfiguration = closeInfo.eventConfiguration;
                        this.props.record.update(eventConfiguration);
                    }
                }
            }
        );
    },
});
