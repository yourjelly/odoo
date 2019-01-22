odoo.define('pos_restaurant.mobile', function (require) {
"use strict";

var ajax = require('web.ajax');
var config = require('web.config');
var core = require('web.core');
var BaseWidget = require('point_of_sale.BaseWidget');
var Chrome = require('point_of_sale.chrome');
var PosGui = require('point_of_sale.gui');
var Screens = require('point_of_sale.screens');
var PosMobile = require('pos_mobile.mobile');
var RestaurantFloors = require('pos_restaurant.floors');
var models = require('point_of_sale.models')

var QWeb = core.qweb;
var _t = core._t;

if(!config.device.isMobile) {
    return;
}

models.load_models({
    label: "templates restaurant",
    loaded: function() {
        return ajax.loadXML("/pos_restaurant/static/src/xml/restaurant_mobile.xml", core.qweb);
    }
});

RestaurantFloors.TableWidget.include({
    template: 'TableMobileWidget',
    get_background_style: function () {
        if (this.table.color) {
            return "background: " + this.table.color +";";
        }
        return "";
    },
});
RestaurantFloors.FloorScreenWidget.include({
    template: 'FloorScreenMobileWidget',
    renderElement: function () {
        var self = this;
        // cleanup table widgets from previous renders
        for (var i = 0; i < this.table_widgets.length; i++) {
            this.table_widgets[i].destroy();
        }
        this.table_widgets = [];
        this._super.apply(this, arguments);

        for (var i = 0; i < this.floor.tables.length; i++) {
            var tw = new RestaurantFloors.TableWidget(this, {
                table: this.floor.tables[i],
            });
            tw.appendTo(this.$('.floor-map .floor-tables'));
            this.table_widgets.push(tw);
        }
    },
});

PosMobile.MobileHeaderOptionWidget.include({
    _onClickHeaderMenuItem: function (ev) {
        this._super.apply(this, arguments);
        var action = $(ev.currentTarget).data("menu");
        if (action === "go_to_floors") {
            this.pos.set_table(null);
        }
    }   
});

PosGui.Gui.include({
    show_screen: function (screen) {
        this._super.apply(this, arguments);
        if (this.pos.config.iface_floorplan) {
            var header = this.chrome.widget.mobile_options;
            header.$("li[data-menu='delete_order']").toggleClass('oe_hidden', screen == "floors");
            header.$("button[data-menu='add_new_order']").toggleClass('oe_hidden', screen == "floors");
            header.$("button[data-menu='go_to_floors']").toggleClass('oe_hidden', screen == "floors");
            var quick_order_view = this.chrome.widget.mobile_quick_order_view;
            if (screen === "floors") {
                quick_order_view.hide();
            } else {
                quick_order_view._updateSummary();
            }
        }
    }
});

});
