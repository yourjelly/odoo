odoo.define('bus.WebClient', function (require) {
    "use strict";

    const core = require('web.core');
    const { onMounted , onWillUnmount } = owl.hooks;
    const WebClient = require('web.WebClient');

    const _t = core._t;

    WebClient.patch('bus.WebClient', T =>
        class WebClientBus extends T {

        //----------------------------------------------------------------------
        // Public
        //----------------------------------------------------------------------

        /**
         * Detects the presence of assets in DOM's HEAD
         *
         * @override
         */
        constructor() {
            super(...arguments);
            this._assetsChangedNotificationId = null;
            this._assets = {};
            // Assign handler to bus notification
            onMounted(() => {
                document.querySelectorAll('*[data-asset-xmlid]').forEach(el => {
                    this._assets[el.getAttribute('data-asset-xmlid')] = el.getAttribute('data-asset-version');
                });
                const busService = this.env.services.bus_service;
                if (busService) {
                    busService.onNotification(this, this._onNotification);
                    busService.addChannel('bundle_changed');
                }
            });
            onWillUnmount(() => {
                if (this.env.services.bus_service) {
                    this.env.services.bus_service.off('notification', this);
                }
            });
        }

        //----------------------------------------------------------------------
        // Private
        //----------------------------------------------------------------------

        /**
         * Displays one notification on user's screen when assets have changed
         *
         * @private
         */
        _displayBundleChangedNotification() {
            if (!this._assetsChangedNotificationId) {
                // Wrap the notification inside a delay.
                // The server may be overwhelmed with recomputing assets
                // We wait until things settle down
                clearTimeout(this._bundleNotifTimerID);
                this._bundleNotifTimerID = setTimeout(() => {
                    this._assetsChangedNotificationId = this._displayNotification({
                        title: _t('Refresh'),
                        message: _t('The page appears to be out of date.'),
                        sticky: true,
                        onClose: () => {
                            this._assetsChangedNotificationId = null;
                        },
                        buttons: [{
                            text: _t('Refresh'),
                            primary: true,
                            click: () => {
                                window.location.reload(true);
                            }
                        }],
                    });
                }, this._getBundleNotificationDelay());
            }
        }
        /**
         * Computes a random delay to avoid hammering the server
         * when bundles change with all the users reloading
         * at the same time
         *
         * @private
         * @return {number} delay in milliseconds
         */
        _getBundleNotificationDelay() {
            return 10000 + Math.floor(Math.random()*50) * 1000;
        }

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Reacts to bus's notification
         *
         * @private
         * @param {Array} notifications: list of received notifications
         */
        _onNotification(notifications) {
            for (const notif of notifications) {
                if (notif[0][1] === 'bundle_changed') {
                    const bundleXmlId = notif[1][0];
                    const bundleVersion = notif[1][1];
                    if (bundleXmlId in this._assets && bundleVersion !== this._assets[bundleXmlId]) {
                        this._displayBundleChangedNotification();
                        break;
                    }
                }
            }
        }
    });
});
