odoo.define('point_of_sale.PointOfSaleUI', function (require) {
    'use strict';

    const { loadCSS } = require('web.ajax');
    const { useListener } = require('web.custom_hooks');
    const { CrashManager } = require('web.CrashManager');
    const { BarcodeEvents } = require('barcodes.BarcodeEvents');
    const PosComponent = require('point_of_sale.PosComponent');
    const TicketButton = require('point_of_sale.TicketButton');
    const HeaderButton = require('point_of_sale.HeaderButton');
    const CashierName = require('point_of_sale.CashierName');
    const ProxyStatus = require('point_of_sale.ProxyStatus');
    const SyncNotification = require('point_of_sale.SyncNotification');
    const ClientScreenButton = require('point_of_sale.ClientScreenButton');
    const SaleDetailsButton = require('point_of_sale.SaleDetailsButton');
    const OrderManagementButton = require('point_of_sale.OrderManagementButton');
    const NumberBuffer = require('point_of_sale.NumberBuffer');
    const ProductScreen = require('point_of_sale.ProductScreen');
    const TicketScreen = require('point_of_sale.TicketScreen');
    const ClientListScreen = require('point_of_sale.ClientListScreen');
    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const ReceiptScreen = require('point_of_sale.ReceiptScreen');
    const OrderManagementScreen = require('point_of_sale.OrderManagementScreen');
    const ReprintReceiptScreen = require('point_of_sale.ReprintReceiptScreen');
    const ScaleScreen = require('point_of_sale.ScaleScreen');
    const BasicSearchBar = require('point_of_sale.BasicSearchBar');
    const Dialog = require('point_of_sale.Dialog');
    const Notification = require('point_of_sale.Notification');
    const NotificationSound = require('point_of_sale.NotificationSound');
    const DebugWidget = require('point_of_sale.DebugWidget');

    class PointOfSaleUI extends PosComponent {
        static template = 'PointOfSaleUI';
        static components = {
            TicketButton,
            HeaderButton,
            CashierName,
            ProxyStatus,
            SyncNotification,
            ClientScreenButton,
            SaleDetailsButton,
            OrderManagementButton,
            ProductScreen,
            TicketScreen,
            ClientListScreen,
            PaymentScreen,
            ReceiptScreen,
            ReprintReceiptScreen,
            OrderManagementScreen,
            ScaleScreen,
            BasicSearchBar,
            Dialog,
            Notification,
            NotificationSound,
            DebugWidget,
        };

        constructor() {
            super(...arguments);
            this.basicSearchBarRef = owl.hooks.useRef('basic-search-bar');
            this.syncNotificationRef = owl.hooks.useRef('sync-notification-ref');
            this.dialogRef = owl.hooks.useRef('dialog-ref');
            this.toastNotificationRef = owl.hooks.useRef('toast-notification-ref');
            this.notificationSoundRef = owl.hooks.useRef('notification-sound-ref');
            useListener('toggle-debug-widget', () => {
                this.state.debugWidgetIsShown = !this.state.debugWidgetIsShown;
            });
            useListener('click-sync-notification', this._onClickSyncNotification);
            useListener('show-temp-screen', this.__showTempScreen);
            useListener('close-temp-screen', this.__closeTempScreen);
            this.state = owl.useState({ tempScreenName: false, debugWidgetIsShown: true });
            this._tempScreenProps = {};
            NumberBuffer.activate();
            this.env.model.useModel();
            // To make sure rpc calls are not repeated for repeated clicking
            this._syncing = false;
        }
        mounted() {
            // remove default webclient handlers that induce click delay
            $(document).off();
            $(window).off();
            $('html').off();
            $('body').off();
            // The above lines removed the bindings, but we really need them for the barcode
            BarcodeEvents.start();
            this._buildChrome();
            this._disableBackspaceBack();
            this._replaceCrashmanager();
            this._loadPos().then(() => {
                this._afterLoadPos();
            });
        }
        willUnmount() {
            BarcodeEvents.stop();
        }
        async _onClickSyncNotification() {
            if (this._syncing) return;
            this._syncing = true;
            await this.env.actionHandler({ name: 'actionSyncOrders' });
            this._syncing = false;
        }
        getMainScreen() {
            const activeScreen = this.env.model.getActiveScreen();
            const activeScreenProps = this.env.model.getActiveScreenProps();
            return {
                name: activeScreen,
                component: this.constructor.components[activeScreen],
                props: activeScreenProps,
            };
        }
        getTempScreen() {
            const name = this.state.tempScreenName;
            if (!name) return false;
            return {
                name,
                component: this.constructor.components[name],
                props: this._tempScreenProps,
            };
        }
        getSyncNotificationMsg() {
            return this.env.model.getOrdersToSync().length;
        }
        __showTempScreen({ detail: { name, props, resolve } }) {
            this.state.tempScreenName = name;
            Object.assign(this._tempScreenProps, props, { resolve });
        }
        __closeTempScreen() {
            this.state.tempScreenName = false;
            Object.assign(this._tempScreenProps, {});
        }
        /**
         * This method is called when this component is properly mounted.
         */
        async _loadPos() {
            try {
                await this.env.model.loadPosData();
                await this.env.model.afterLoadPosData();
                await this.env.actionHandler({ name: 'actionDoneLoading' });
            } catch (error) {
                let title = this.env._t('Unknown Error');
                let body;
                if (error.message && [100, 200, 404, -32098].includes(error.message.code)) {
                    // this is the signature of rpc error
                    if (error.message.code === -32098) {
                        title = this.env._t('Network Failure (XmlHttpRequestError)');
                        body = this.env._t(
                            'The Point of Sale could not be loaded due to a network problem.\n' +
                                'Please check your internet connection.'
                        );
                    } else if (error.message.code === 200) {
                        title = error.message.data.message || this.env._t('Server Error');
                        body =
                            error.message.data.debug ||
                            this.env._t('The server encountered an error while receiving your order.');
                    }
                } else if (error instanceof Error) {
                    title = error.message;
                    body = error.stack;
                }
                await this.env.ui.askUser('ErrorTracebackPopup', {
                    title,
                    body,
                    exitButtonIsShown: true,
                });
            }
        }
        async _afterLoadPos() {
            this._preloadImages();
            this._loadFonts();
        }

        //#region MISC

        /**
         * /!\ ATTENTION: This works as long as you are in production mode. In dev mode,
         * different js files are asking for the images (this file and the owl.js file).
         * Because of that, even if this file already preloaded the images, owl.js (during
         * rendering) will still ask for them and it will appear that the images are not
         * cached (you will see that it still tries to reach the server). Not sure if
         * this is a bug or a feature of chrome.
         */
        async _preloadImages() {
            const imageUrls = [];
            for (const product of this.env.model.getProducts(0)) {
                imageUrls.push(this.env.model.getImageUrl('product.product', product));
            }
            for (const category of this.env.model.getRecords('pos.category')) {
                if (category.id == 0) continue;
                imageUrls.push(this.env.model.getImageUrl('pos.category', category));
            }
            for (const imageName of ['backspace.png', 'bc-arrow-big.png']) {
                imageUrls.push(`/point_of_sale/static/src/img/${imageName}`);
            }
            await this.env.model.loadImages(imageUrls);
        }
        _loadFonts() {
            return new Promise(function (resolve, reject) {
                // Waiting for fonts to be loaded to prevent receipt printing
                // from printing empty receipt while loading Inconsolata
                // ( The font used for the receipt )
                waitForWebfonts(['Lato', 'Inconsolata'], function () {
                    resolve();
                });
                // The JS used to detect font loading is not 100% robust, so
                // do not wait more than 5sec
                setTimeout(resolve, 5000);
            });
        }
        _buildChrome() {
            if ($.browser.chrome) {
                var chrome_version = $.browser.version.split('.')[0];
                if (parseInt(chrome_version, 10) >= 50) {
                    loadCSS('/point_of_sale/static/src/css/chrome50.css');
                }
            }
        }
        /**
         * Use pos popup to show detected crashes.
         */
        _replaceCrashmanager() {
            const self = this;
            CrashManager.include({
                show_error: function (error) {
                    if (self.env) {
                        // self == this component
                        self.env.ui.askUser('ErrorTracebackPopup', {
                            title: error.type,
                            body: error.message + '\n' + error.data.debug + '\n',
                        });
                    } else {
                        // this == CrashManager instance
                        this._super(error);
                    }
                },
            });
        }
        /**
         * NOTE: Doesn't seem to be needed. But to be sure, just do it anyway.
         */
        _disableBackspaceBack() {
            $(document).on('keydown', function (e) {
                if (e.which === 8 && !$(e.target).is('input, textarea')) {
                    e.preventDefault();
                }
            });
        }

        //#endregion
    }

    return PointOfSaleUI;
});
