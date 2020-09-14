odoo.define('hr_timesheet.res.config.form', function (require) {
    "use strict";

    const viewRegistry = require('web.view_registry');
    const BaseSetting = require('base_setup.res.config.form');
    const { ComponentWrapper } = require('web.OwlCompatibility');
    const AppStoreIcon = require('base_setup.AppStoreIcon');


    const TimesheetConfigFormRenderer = BaseSetting.BaseSettingRenderer.extend({
        /**
         * @override
         */
        async _renderView() {
            await this._super(...arguments);
            this.timesheetConfigFormWrapper = new ComponentWrapper(this, AppStoreIcon);
            const el = this.el.querySelector('#synchronize_web_mobile_setting > div.o_setting_right_pane > div.content-group');
            this.timesheetConfigFormWrapper.mount(el);
        }
    });


    const BaseSettingView = viewRegistry.get('base_settings');
    var TimesheetConfigFormView = BaseSettingView.extend({
        config: _.extend({}, BaseSettingView.prototype.config, {
            Renderer : TimesheetConfigFormRenderer,
        }),
    });

    viewRegistry.add('hr_timesheet_config_form', TimesheetConfigFormView);

    return {TimesheetConfigFormRenderer, TimesheetConfigFormView};

});
