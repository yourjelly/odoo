odoo.define('mass_mailing.AddFavorite_controller', function(require) {
    'use strict';

    var FormView = require('web.FormView');
    var FormController = require('web.FormController');
    var viewRegistry = require('web.view_registry');


    var MassMailingController = FormController.extend({
        custom_events: _.extend({}, FormController.prototype.custom_events, {
            'mass_mailing_save': '_createFilter',
            'mass_mailing_remove': '_removeFilter'
        }),

        _createFilter: function (ev) {
            var self = this;
            var name = ev.data.filterName;
            let state = this.model.get(this.handle);
            this._rpc({
                model: 'mailing.saved.filters',
                method: 'create',
                args: [{
                    name: name,
                    mailing_domain: state.data.mailing_domain
                }]
            }).then(function () {
                self.reload();
            });
        },

        _removeFilter: function (ev) {
            var self = this;
            let state = this.model.get(this.handle);
            this._rpc({
            'model': 'mailing.saved.filters',
            'method': 'unlink',
            'args': [state.data.filter_id.data.id]
            }).then(function () {
                self.reload();
            });
        }
    });

    var MassMailingFormView = FormView.extend({
        config: _.extend({}, FormView.prototype.config, {
            Controller: MassMailingController,
        }),
    });

    viewRegistry.add('mass_mailing_form', MassMailingFormView);
    return MassMailingFormView;
});
