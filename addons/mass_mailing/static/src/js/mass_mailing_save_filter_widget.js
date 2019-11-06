odoo.define('mass_mailing.AddFavorite', function (require) {
    "use strict";

    var AbstractField = require('web.AbstractField');
    var core = require('web.core');
    var fieldRegistry = require('web.field_registry');

    var _t = core._t;

    var AddFavoriteWidget = AbstractField.extend({
        template: "mass_mailing.favorite_filter",
        events: {
            'click .o_domain_save_button': '_onClickSave',
            'click .o_remove_favorite_filter': '_onClickRemove'
        },
        /**
         * @constructor
         */
        init: function () {
            this.isFavorite = this.value;
            this._super.apply(this, arguments);
        },
        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------
        /**
         * @override
         * @private
         */
        _render: function () {
            this.isFavorite = this.value;
            if (this.isFavorite) {
                $('.o_add_favorite_filter').hide();
                $('.o_remove_favorite_filter').show();
            } else {
                $('.o_add_favorite_filter').show();
                $('.o_remove_favorite_filter').hide();
            }
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------
        _onClickSave: function () {
            var name = $('.o_domain_save_name').val();
            if (name.length !== 0) {
                this.trigger_up('mass_mailing_save', {
                    filterName: name,
                });
            } else {
                this.do_warn(_t("Warning"), "please enter a name");
            }

        },
        _onClickRemove: function () {
            this.trigger_up('mass_mailing_remove', {});
        },
    });

    fieldRegistry.add('add_favorite', AddFavoriteWidget);

    return AddFavoriteWidget;
    });
