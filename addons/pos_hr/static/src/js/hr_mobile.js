odoo.define('pos_hr.mobile', function (require) {
"use strict";

var ajax = require('web.ajax');
var core = require('web.core');
var config = require('web.config');
var PosMobile = require('pos_mobile.mobile');
var models = require('point_of_sale.models')

if(!config.device.isMobile) {
    return;
}

models.load_models({
    label: "templates hr",
    loaded: function() {
        return ajax.loadXML("/pos_hr/static/src/xml/pos_mobile.xml", core.qweb);
    }
});

PosMobile.MobileHeaderOptionWidget.include({
    _onClickHeaderMenuItem: function (ev) {
        this._super.apply(this, arguments);
        if(this.pos.config.module_pos_hr) {
            var action = $(ev.currentTarget).data("menu");
            if (action === "lock_screen") {
                this.gui.show_screen('login');
            }
        }
    }   
});
});
