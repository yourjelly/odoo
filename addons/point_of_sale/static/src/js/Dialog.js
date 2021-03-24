odoo.define('point_of_sale.Dialog', function (require) {
    'use strict';

    const ConfirmPopup = require('point_of_sale.ConfirmPopup');
    const NumberPopup = require('point_of_sale.NumberPopup');
    const EditListPopup = require('point_of_sale.EditListPopup');
    const ErrorBarcodePopup = require('point_of_sale.ErrorBarcodePopup');
    const SelectionPopup = require('point_of_sale.SelectionPopup');
    const ErrorPopup = require('point_of_sale.ErrorPopup');
    const ErrorTracebackPopup = require('point_of_sale.ErrorTracebackPopup');
    const OfflineErrorPopup = require('point_of_sale.OfflineErrorPopup');
    const OrderImportPopup = require('point_of_sale.OrderImportPopup');
    const CashOpeningPopup = require('point_of_sale.CashOpeningPopup');
    const TextAreaPopup = require('point_of_sale.TextAreaPopup');
    const TextInputPopup = require('point_of_sale.TextInputPopup');
    const { ProductConfiguratorPopup } = require('point_of_sale.ProductConfiguratorPopup');

    /**
     * This component is somewhat the controller of the Popups.
     * 1. Define a Popup component with an assumed `respondWith` prop.
     * 2. Inside the Popup component, it should call `respondWith` to
     * close it and _send_ the result.
     * 3. Register the Popup component in the static `components` field
     * of Dialog, with the key as the name of the Popup.
     * 4. Make sure it is mounted to the dom. @see PointOfSaleUI component
     * 5. Use the registered popup like so:
     * ```
     *  // Assuming an 'edit-list' Popup is registered in Dialog.
     *  const [confirm, newList] = await dialog.askUser('EditListPopup', {
     *      message: 'Please edit the list', list: oldList
     *  });
     *  if (confirm) {
     *      // do something with newList
     *  }
     * ```
     * In short, this is just a glorified callback implementation
     * of dialog. We just made it more generic so that we can
     * render any type of dialogs/popups and have a simpler way
     * of opening/closing the dialogs.
     */
    class Dialog extends owl.Component {
        static components = {
            ConfirmPopup,
            NumberPopup,
            EditListPopup,
            ProductConfiguratorPopup,
            ErrorBarcodePopup,
            ErrorPopup,
            ErrorTracebackPopup,
            OfflineErrorPopup,
            SelectionPopup,
            OrderImportPopup,
            CashOpeningPopup,
            TextAreaPopup,
            TextInputPopup,
        };
        static template = owl.tags.xml/* html */ `
            <div class="popups">
                <t  t-if="state.showDialog" t-component="dialogComponent" t-props="dialogProps" t-key="dialogName" />
            </div>
        `;
        state = owl.useState({ showDialog: false });
        dialogName = '';
        dialogProps = {};
        dialogComponent = false;
        askUser(dialogName, props = {}) {
            // if `show` props is explicitly given and it is false, then skip on showing the popup.
            // Useful for popups with options to not be shown.
            if ('show' in props && !props.show) return;
            return new Promise((resolve, reject) => {
                this.state.showDialog = true;
                this.dialogName = dialogName;
                this.dialogComponent = this.constructor.components[dialogName] || false;
                if (!this.dialogComponent) {
                    reject(`Invalid dialog: '${dialogName}'`);
                    return;
                }
                this.dialogProps = {
                    ...props,
                    respondWith: (result) => {
                        this.state.showDialog = false;
                        this.dialogName = '';
                        this.dialogProps = {};
                        this.dialogComponent = false;
                        resolve(result);
                    },
                };
            });
        }
    }

    return Dialog;
});
