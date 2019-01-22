odoo.define('pos_mobile.mobile', function (require) {
"use strict";

var ajax = require('web.ajax');
var BaseWidget = require('point_of_sale.BaseWidget');
var Chrome = require('point_of_sale.chrome');
var Screens = require('point_of_sale.screens');
var config = require('web.config');
var core = require('web.core');
var models = require('point_of_sale.models')

var QWeb = core.qweb;
var _t = core._t;

if(!config.device.isMobile) {
    return;
}

/*
    Loading mobile customisation when loaded on mobile onlys,
    We can not use xmlDependancies of Chrome Widget because
    Widgets are loaded before willStart.
*/
models.load_models({
    label: "templates",
    loaded: function() {
        return ajax.loadXML("/point_of_sale/static/src/xml/pos_mobile.xml", core.qweb);
    }
});

// Activiating mobile widgets
Chrome.Chrome.include({
    /**
     * This method instantiates all the screens, widgets, etc.
     *
     * @override
     */
    build_widgets: function () {
        this.widgets = Chrome.Chrome.prototype.widgets.concat(
            {
                name: 'mobile_options',
                widget: MobileHeaderOptionWidget,
                replace: '.placeholder-MobileHeaderOptionWidget'
            },
            {
                name: 'mobile_order_selector',
                widget: MobileOrderSelectorWidget,
                replace: '.placeholder-MobileOrderSelectorWidget'
            },
            {
                name: 'mobile_quick_order_view',
                widget: MobileOrderBottomWidget,
                replace: '.placeholder-MobileOrderBottomWidget'
            }
        );
        this._super.apply(this, arguments);
    },

    /**
     * Add mobile class on loader
     *
     * @override
     */
    start: function () {
        var sup = this._super.apply(this, arguments);
        this.chrome.$el.addClass('mobile');
        return sup;
    },

    /**
     * Add mobile class on POS after loader finish
     *
     * @override
     */
    build_chrome: function () {
        this._super.apply(this, arguments);
        this.$el.addClass('mobile');
    }
});

BaseWidget.include({
    /**
     * Disable virtual keyboard in mobile
     *
     * @override
     */
    init: function () {
        this._super.apply(this, arguments);
        if (this.pos && this.pos.config) {
            this.pos.config.iface_vkeyboard = false;
        }
    },
});

var MobileOrderSelectorWidget = Chrome.OrderSelectorWidget.extend({
    template: 'MobileOrderSelectorWidget',
    events: {
        'click .switch_to_order': '_onClickSwithToOrder',
        'click [data-menu]': '_onClickHeaderMenuItem',
    },
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Allow user to switch between orders
     *
     * @private
     * @param {Object} options (optional)
     * @returns {Deferred}
     */
    _switchToOrder: function(options) {
        options = options || {};
        var self = this;
        var def  = $.Deferred();
        var list = _.map(this.pos.get_order_list(), function(order) {
            var orderTime = moment(order.creation_date).format('hh:mm');
            return {
                label: _.str.sprintf("#%s %s [%s]", order.sequence_number, order.name, orderTime),
                item: order
            };
        });
        this.gui.show_popup('selection', {
            title: options.title || _t('Select Order'),
            list: list,
            confirm: function(order) { def.resolve(order); },
            cancel: function() { def.reject(); },
            is_selected: function(order) { return order === self.pos.get_order(); },
        });
        return def;
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------
    /**
     * Handles dropdown menu item clicks
     *
     * @private
     * @params {MouseEvent} ev
     */
    _onClickHeaderMenuItem: function (ev) {
        var self = this;
        var action = $(ev.currentTarget).data("menu");
        switch(action) {
            case "add_new_order":
                this.pos.add_new_order();
            break;
            case "delete_order":
                var self  = this;
                var order = this.pos.get_order();
                if (order && !order.is_empty()) {
                    this.gui.show_popup('confirm', {
                        'title': _t('Destroy Current Order ?'),
                        'body': _t('You will lose any data associated with the current order'),
                        confirm: function () {
                            self.pos.delete_current_order();
                        },
                    });
                } else {
                    this.pos.delete_current_order();
                }
            break;
        }
    },
    /**
     * Handles switch to order click for mobile screen
     * @private
     */
    _onClickSwithToOrder: function(ev) {
        if (this.pos.get_order_list().length == 1) return;
        var self = this;
        this._switchToOrder().then(function(order) {
            var order = self.get_order_by_uid(order.uid);
            if (order) {
                self.pos.set_order(order);
            }
        });
    },
});

var MobileHeaderOptionWidget = BaseWidget.extend({
    template: 'MobileHeaderOptionWidget',
    events: {
        'click .dropbtn': '_onClickDropBtn',
        'click [data-menu]': '_onClickHeaderMenuItem',
    },
    /**
     * @override
     */
    init: function (parent, options) {
        options = options || {};
        this._super.apply(this, arguments);
        var user = this.pos.get_cashier();
        this.userName = user.name || '';
    },

    /**
     * @override
     */
    start: function () {
        var self = this;
        // FIXME Global event for hidning dropdown when click outside
        $('.pos-content').on('click', function(ev) {
            self._toggleDropdown(false);
        });
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _toggleDropdown: function(show) {
        this.$('.dropdown-content').toggleClass('show', show);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Toggle header dropdown menu for mobile
     *
     * @private
     */
    _onClickDropBtn: function (ev) {
        this._toggleDropdown();
    },

    /**
     * Handles dropdown menu item clicks
     *
     * @private
     * @params {MouseEvent} ev
     */
    _onClickHeaderMenuItem: function (ev) {
        var self = this;
        var action = $(ev.currentTarget).data("menu");
        switch(action) {
            case "switch_user":
                var self = this;
                if(!this.pos.config.module_pos_hr) {
                    ev.preventDefault();
                    return;
                }
                this.gui.select_employee({
                    'security': true,
                    'current_user': this.pos.get_cashier(),
                    'title': _t('Change Cashier'),
                }).then(function (employee) {
                    self.pos.set_cashier(employee);
                    self.$('.active_cashier').text(employee.name);
                });
            break;
            case "close_pos":
                this.gui.show_popup('confirm',{
                    'title': _t('Close Session ?'),
                    'body': _t('You are going to close your point of sale session. Are you Sure ?'),
                    confirm: function(){
                        self.gui.close();
                    },
                });
            break;
        }
        this._toggleDropdown(false);
    }
});

Screens.ActionpadWidget.include({
    /**
     * @override
     */
    renderElement: function () {
        var self = this;
        this._super.apply(this, arguments);
        this.$(".btn-product-view").on('click', function () {
            self.pos.trigger("mobile:product_screen", true);
        });
    }
});

var MobileOrderBottomWidget = BaseWidget.extend({
    template: 'MobileOrderBottomWidget',
    events: {
        'click .view_order': '_onClickViewOrder'
    },

    /**
     * @override
     */
    init: function(parent, options) {
        this._super.apply(this, arguments);
        this.productScreenVisible = true;
        this.pos.bind('change:selectedOrder', this._onChangeSelectedOrder, this);
        this.pos.bind('mobile:product_screen_toggle', this._onToggleOrderScreen, this);
        if (this.pos.get_order()) {
            this._bindOrderEvents();
        }
    },

    /**
     * @override
     */
    start: function() {
        this._super.apply(this, arguments);
        this.hide();
        this._updateSummary();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * Update Quick order view values with current order.
     * Also hide if there is no lines available on order.
     *
     * @private
     */
    _updateSummary: function() {
        var order = this.pos.get_order();
        if (!order) return;

        // When on order screen, and user remove all products and try to create new order
        // User must be redirected to select products.
        if (!order.get_orderlines().length || !this.productScreenVisible) {
            if (!this.productScreenVisible && !order.get_orderlines().length) {
                this.productScreenVisible = true;
                this.pos.trigger("mobile:product_screen", true);
            }
            this.hide();
            return;
        }
        this.show();

        var total = order ? order.get_total_with_tax() : 0;
        var taxes = order ? total - order.get_total_without_tax() : 0;
        this.$(".item_counter").text(order.get_orderlines().length);
        this.$(".total_price").text(this.format_currency(total));
        this.$(".total_taxes").text(this.format_currency(taxes));
    },

    /**
     * Bind event for order and order lines
     *
     * @private
     */
    _bindOrderEvents: function() {
        var order = this.pos.get_order();
        order.unbind('change:client', this._updateSummary, this);
        order.bind('change:client',   this._updateSummary, this);
        order.unbind('change',        this._updateSummary, this);
        order.bind('change',          this._updateSummary, this);
        var lines = order.orderlines;
        lines.unbind('change',  this._updateSummary, this);
        lines.bind('change',    this._updateSummary, this);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Change order details when user switch between orders
     *
     * @private
     */
    _onChangeSelectedOrder: function() {
        if(this.pos.get_order()) {
            this._bindOrderEvents();
            this._updateSummary();
        }
    },

    /**
     *
     * @private
     * @params {MouseEvent} ev
     */
    _onClickViewOrder: function (ev) {
        this.pos.trigger("mobile:product_screen", false);
    },

    /**
     * Update order summer if user on product screen else hide order view
     *
     * @private
     * @params {Boolean} productScreenVisible
     */
    _onToggleOrderScreen: function(productScreenVisible) {
        this.productScreenVisible = productScreenVisible;
        if (productScreenVisible) {
            this._updateSummary();
        } else {
            this.hide();
        }
    }
});

Screens.ProductScreenWidget.include({
    /**
     * @override
     */
    init: function() {
        this._super.apply(this, arguments);
        this.pos.bind("mobile:product_screen", this._onShowMobileProductScreen, this);
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * Toggle visiblity of panes (Left for order detail and right for products)
     *
     * @private
     * @params {Boolean} showProducts
     */
    _onShowMobileProductScreen: function (showProducts) {
        this.$(".leftpane").toggle(!showProducts);
        this.$(".rightpane").toggle(showProducts);
        this.pos.trigger("mobile:product_screen_toggle", showProducts);
    }
});

Screens.ClientListScreenWidget.include({
    /**
     * Shows, hides or edit the customer details box with mobile screens
     *
     * @override
     */
    display_client_details: function(visibility, partner, clickpos) {
        var self = this;
        var listScreen = this.$(".screen-content:not(.screen_client_detail)");
        var detailScreen = this.$(".screen-content.screen_client_detail");
        var contents = this.$(".screen_client_detail .client-details-contents");
        this.$(".goback").on('click', function() {
            listScreen.removeClass("oe_hidden");
            detailScreen.addClass("oe_hidden");
        });
        contents.off('click', '.button.edit');
        contents.off('click', '.button.save');
        contents.off('click', '.button.undo');
        contents.on('click', '.button.edit', function() { self.edit_client_details(partner); });
        contents.on('click', '.button.save', function() { self.save_client_details(partner); });
        contents.on('click', '.button.undo', function() { self.undo_client_details(partner); });
        this.editing_client = false;
        this.uploaded_picture = null;

        if (visibility == "show") {
            contents.html($(QWeb.render('ClientDetails',{widget:this,partner:partner})));
            listScreen.addClass("oe_hidden");
            detailScreen.removeClass("oe_hidden");
            this.details_visible = true;
            this.toggle_save_button();
        } else if (visibility === 'edit') {
            contents.html($(QWeb.render('ClientDetailsEdit',{widget:this,partner:partner})));

            listScreen.addClass("oe_hidden");
            detailScreen.removeClass("oe_hidden");
            this.editing_client = true;
            this.toggle_save_button();

            contents.find('.image-uploader').on('change',function(event){
                self.load_image_file(event.target.files[0],function(res){
                    if (res) {
                        contents.find('.client-picture img, .client-picture .fa').remove();
                        contents.find('.client-picture').append("<img src='"+res+"'>");
                        contents.find('.detail.picture').remove();
                        self.uploaded_picture = res;
                    }
                });
            });
        } else if (visibility === 'hide') {
            contents.html("");
            this.details_visible = false;
            this.toggle_save_button();
            listScreen.removeClass("oe_hidden");
            detailScreen.addClass("oe_hidden");
        }
    },
});

return {
    MobileOrderSelectorWidget: MobileOrderSelectorWidget,
    MobileOrderBottomWidget: MobileOrderBottomWidget,
    MobileHeaderOptionWidget: MobileHeaderOptionWidget
}

});
