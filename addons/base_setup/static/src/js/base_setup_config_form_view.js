odoo.define('base_setup.res.config.form', function (require) {
    "use strict";

    const viewRegistry = require('web.view_registry');
    const BaseSetting = require('base.settings');
    const { ComponentWrapper } = require('web.OwlCompatibility');
    const AppStoreIcon = require('base_setup.AppStoreIcon');


    const BaseSettingRenderer = BaseSetting.Renderer.extend({
        /**
         * @override
         */
        async _renderView() {
            await this._super(...arguments);
            this.baseSettingWrapper = new ComponentWrapper(this, AppStoreIcon);
            const el = this.el.querySelector('#about > div > .o_setting_box > div');
            this.baseSettingWrapper.mount(el);
        }
    });


    const BaseSettingView = viewRegistry.get('base_settings');
    var BaseSetupSettingView = BaseSettingView.extend({
        config: _.extend({}, BaseSettingView.prototype.config, {
            Renderer : BaseSettingRenderer,
        }),
    });

    viewRegistry.add('base_setup_config_form', BaseSetupSettingView);

    return {BaseSettingRenderer, BaseSetupSettingView};

});
