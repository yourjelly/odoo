odoo.define('web.AddNewFavoriteMenu', function (require) {
"use strict";

var core = require('web.core');
var Widget = require('web.Widget');
var favorites_submenus_registry = require('web.favorites_submenus_registry');

var _t = core._t;

var AddNewFavoriteMenu = Widget.extend({
    template: 'AddNewFavoriteMenu',
    events: _.extend({}, Widget.prototype.events,
    {
        'click .o_save_favorite': '_onSaveFavoriteClick',
        'click .o_add_favorite.o_menu_header': '_onMenuHeaderClick',
        'keyup .o_save_name input': '_onKeyUp',
    }),

    init: function (parent, params) {
        this._super(parent);
        this.favorites = params.favorites;
        this.isOpen = false;
    },
    start: function () {
        this._render();
        return this._super.apply(this, arguments);
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    closeMenu: function () {
        this.isOpen = false;
        this._render();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _render: function () {
        this.renderElement();
        if (this.isOpen) {
            this.$('.o_favorite_name').focus();
        }
    },
    /**
     * @private
     */
    _saveFavorite: function () {
        var self = this;
        var $inputs = this.$('input');
        var description = $inputs[0].value;
        var isDefault = $inputs[1].checked;
        var isShared = $inputs[2].checked;

        if (!description.length){
            this.do_warn(_t("Error"), _t("A name for your favorite is required."));
            $inputs[0].focus();
            return;
        }
        var descriptionAlreadyExists = !!this.favorites.find(function (favorite) {
            return favorite.description === description;
        });
        if (descriptionAlreadyExists) {
            this.do_warn(_t("Error"), _t("Filter with same name already exists."));
            $inputs[0].focus();
            return;
        }
        this.trigger_up('new_favorite', {
            type: 'favorite',
            description: description,
            isDefault: isDefault,
            isShared: isShared,
            on_success: function () {self.generatorMenuIsOpen = false;},
        });
        this.closeMenu();
    },
    /**
     * Hide and display the submenu which allows adding custom filters
     *
     * @private
     */
    _toggleMenu: function () {
        this.isOpen = !this.isOpen;
        this._render();
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {jQueryEvent} event
     */
    _onMenuHeaderClick: function (event) {
        event.preventDefault();
        event.stopPropagation();
        this._toggleMenu();
    },
    /**
     * @private
     * @param {jQueryEvent} event
     */
    _onKeyUp: function (event) {
        if (event.which === $.ui.keyCode.ENTER) {
            this._saveFavorite();
        }
    },
    /**
     * @private
     * @param {jQueryEvent} event
     */
    _onSaveFavoriteClick: function (event) {
        event.stopPropagation();
        this._saveFavorite();
    },
});

favorites_submenus_registry.add('add_new_favorite_menu', AddNewFavoriteMenu, 0);

return AddNewFavoriteMenu;

});