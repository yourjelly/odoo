odoo.define('base_setup.AppStoreIcon', function (require) {
    "use strict";

    const { Component } = owl;

    class AppStoreIcon extends Component {

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * @private
         * @param {MouseEvent} ev
         */
        _onclickAppStore(ev) {
            ev.stopPropagation();
            const apple_url = "https://apps.apple.com/be/app/awesome-timesheet/id1078657549";
            const google_url = "https://play.google.com/store/apps/details?id=com.odoo.OdooTimesheets";
            const url = ev.target.name == 'apple_app_store' ? apple_url : google_url;
            if (!this.env.device.isMobile) {
                const action = {
                    name: this.env._t('Download our App'),
                    type: 'ir.actions.client',
                    tag: 'app_store_icon_qr_code_modal',
                    target: 'new',
                };
                this.trigger('do-action', {action: _.extend(action, {params: {'url': url}})});
            } else {
                this.trigger('do-action', {action: {type: 'ir.actions.act_url', url: url}});
            }
        }
    }

    AppStoreIcon.template = 'base_setup.AppStoreIcon'

    return AppStoreIcon;
});
