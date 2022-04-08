odoo.define('website.mobile', function (require) {
'use strict';

const {_t} = require('web.core');
const {Markup} = require('web.utils');
const {MobilePreviewDialog} = require('web_editor.mobile');
var websiteNavbarData = require('website.navbar');

const { registry } = require("@web/core/registry");

var MobileMenu = websiteNavbarData.WebsiteNavbarActionWidget.extend({
    actions: _.extend({}, websiteNavbarData.WebsiteNavbarActionWidget.prototype.actions || {}, {
        'show-mobile-preview': '_onMobilePreviewClick',
    }),

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Called when the mobile action is triggered -> instantiate the mobile
     * preview dialog.
     *
     * @private
     */
    _onMobilePreviewClick: function () {
        if (this.mobilePreview && !this.mobilePreview.isDestroyed()) {
            return this.mobilePreview.close();
        }
        this.mobilePreview = new MobilePreviewDialog(this, {
            title: Markup(_.escape(_t('Mobile preview')) + ' <span class="fa fa-refresh"/>'),
        }).open();
    },
});

registry.category("website_navbar_widgets").add("MobileMenu", {
    Widget: MobileMenu,
    selector: '#mobile-menu',
});

return {
    MobileMenu: MobileMenu,
};
});
