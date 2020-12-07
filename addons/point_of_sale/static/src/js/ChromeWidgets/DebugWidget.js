odoo.define('point_of_sale.DebugWidget', function (require) {
    'use strict';

    const { useState } = owl;
    const { useRef } = owl.hooks;
    const { getFileAsText } = require('point_of_sale.utils');
    const { parse } = require('web.field_utils');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const PosComponent = require('point_of_sale.PosComponent');
    const Draggable = require('point_of_sale.Draggable');

    class DebugWidget extends PosComponent {
        static components = { Draggable };
        constructor() {
            super(...arguments);
            this.state = useState({
                barcodeInput: '',
                weightInput: '',
                isPaidOrdersReady: false,
                isUnpaidOrdersReady: false,
                buffer: NumberBuffer.get(),
            });
            // NOTE: Perhaps this can still be improved.
            // What we do here is loop thru the `event` elements
            // then we assign animation that happens when the event is triggered
            // in the proxy. E.g. if open_cashbox is sent, the open_cashbox element
            // changes color from '#6CD11D' to '#1E1E1E' for a duration of 2sec.
            this.eventElementsRef = {};
            this.animations = {};
            for (let eventName of ['open_cashbox', 'print_receipt', 'scale_read']) {
                this.eventElementsRef[eventName] = useRef(eventName);
                this.env.model.proxy.add_notification(
                    eventName,
                    (() => {
                        if (this.animations[eventName]) {
                            this.animations[eventName].cancel();
                        }
                        const eventElement = this.eventElementsRef[eventName].el;
                        eventElement.style.backgroundColor = '#6CD11D';
                        this.animations[eventName] = eventElement.animate(
                            { backgroundColor: ['#6CD11D', '#1E1E1E'] },
                            2000
                        );
                    }).bind(this)
                );
            }
        }
        mounted() {
            NumberBuffer.on('buffer-update', this, this._onBufferUpdate);
        }
        willUnmount() {
            NumberBuffer.off('buffer-update', this, this._onBufferUpdate);
        }
        setWeight() {
            var weightInKg = parse.float(this.state.weightInput);
            if (!isNaN(weightInKg)) {
                this.env.model.proxy.debug_set_weight(weightInKg);
            }
        }
        resetWeight() {
            this.state.weightInput = '';
            this.env.model.proxy.debug_reset_weight();
        }
        barcodeScan() {
            this.env.model.barcodeReader.scan(this.state.barcodeInput);
        }
        barcodeScanEAN() {
            const ean = this.env.model.barcodeReader.barcode_parser.sanitize_ean(this.state.barcodeInput || '0');
            this.state.barcodeInput = ean;
            this.env.model.barcodeReader.scan(ean);
        }
        async deleteOrders() {
            const confirmed = await this.env.ui.askUser('ConfirmPopup', {
                title: this.env._t('Delete Paid Orders ?'),
                body: this.env._t(
                    'This operation will permanently destroy all paid orders from the local storage. You will lose all the data. This operation cannot be undone.'
                ),
            });
            if (confirmed) {
                await this.env.actionHandler({
                    name: 'actionRemoveOrders',
                    args: [this.env.model.getPersistedPaidOrders()],
                });
            }
        }
        async deleteUnpaidOrders() {
            const confirmed = await this.env.ui.askUser('ConfirmPopup', {
                title: this.env._t('Delete Unpaid Orders ?'),
                body: this.env._t(
                    'This operation will destroy all unpaid orders in the browser. You will lose all the unsaved data and exit the point of sale. This operation cannot be undone.'
                ),
            });
            if (confirmed) {
                // NOTE: No need to call using the action handler because no need for any rerendering,
                // because it is followed by a window location change.
                this.env.model.actionRemoveOrders(this.env.model.getPersistedUnpaidOrders());
                window.location = '/';
            }
        }
        _createBlob(contents) {
            if (typeof contents !== 'string') {
                contents = JSON.stringify(contents, null, 2);
            }
            return new Blob([contents]);
        }
        // IMPROVEMENT: Duplicated codes for downloading paid and unpaid orders.
        // The implementation can be better.
        preparePaidOrders() {
            try {
                this.paidOrdersBlob = this._createBlob(
                    JSON.stringify(
                        {
                            session: this.env.model.session.name,
                            session_id: this.env.model.session.id,
                            date: new Date().toUTCString(),
                            version: this.env.model.version.server_version_info,
                            config_uuid: this.env.model.config.uuid,
                            paid_orders: this.env.model.getPersistedPaidOrders(),
                        },
                        null,
                        2
                    )
                );
                this.state.isPaidOrdersReady = true;
            } catch (error) {
                console.warn(error);
            }
        }
        get paidOrdersFilename() {
            return `${this.env._t('paid orders')} ${moment().format('YYYY-MM-DD-HH-mm-ss')}.json`;
        }
        get paidOrdersURL() {
            var URL = window.URL || window.webkitURL;
            return URL.createObjectURL(this.paidOrdersBlob);
        }
        prepareUnpaidOrders() {
            try {
                this.unpaidOrdersBlob = this._createBlob(
                    JSON.stringify(
                        {
                            session: this.env.model.session.name,
                            session_id: this.env.model.session.id,
                            date: new Date().toUTCString(),
                            version: this.env.model.version.server_version_info,
                            config_uuid: this.env.model.config.uuid,
                            unpaid_orders: this.env.model.getPersistedUnpaidOrders(),
                        },
                        null,
                        2
                    )
                );
                this.state.isUnpaidOrdersReady = true;
            } catch (error) {
                console.warn(error);
            }
        }
        get unpaidOrdersFilename() {
            return `${this.env._t('unpaid orders')} ${moment().format('YYYY-MM-DD-HH-mm-ss')}.json`;
        }
        get unpaidOrdersURL() {
            var URL = window.URL || window.webkitURL;
            return URL.createObjectURL(this.unpaidOrdersBlob);
        }
        async importOrders(event) {
            const file = event.target.files[0];
            if (file) {
                const report = await this.env.actionHandler({
                    name: 'actionImportOrders',
                    args: [await getFileAsText(file)],
                });
                // No need to wait for the user's response on the import popup
                // before dispatching `actionSyncOrders`.
                this.env.ui.askUser('OrderImportPopup', { report });
                await this.env.actionHandler({ name: 'actionSyncOrders' });
            }
        }
        refreshDisplay() {
            this.env.model.proxy.message('display_refresh', {});
        }
        _onBufferUpdate(buffer) {
            this.state.buffer = buffer;
        }
        get bufferRepr() {
            return `"${this.state.buffer}"`;
        }
    }
    DebugWidget.template = 'DebugWidget';

    return DebugWidget;
});
