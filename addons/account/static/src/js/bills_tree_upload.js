odoo.define('web.UploadBillMixin', function (require) {
"use strict";

    var core = require('web.core');
    var _t = core._t;

    var UploadBillMixin = {
        _onUpload: function (event) {
            var self = this;
            if (!this.initialState.context.journal_type) {
                this.initialState.context.journal_type = event.currentTarget.attributes['journal_type'].value;
            }
            var $uploadInput = $('<input>', {type: 'file', name: 'files[]', multiple: 'multiple'});
            var always = function () {
                $uploadInput.remove();
            };
            $uploadInput.on('change', function (ev) {
                self._processFiles(ev.target.files).then(always).guardedCatch(always);
            });
            $uploadInput.click();
        },

        _processFiles: function (files) {
            var self = this;
            var postData = new FormData();
            postData.append('model', 'account.invoice');
            postData.append('id', 0);
            postData.append('csrf_token', core.csrf_token);
            postData.append('callback', "");
            postData.append('ufile', files);
            _.each(files, function (file) {
                postData.append('ufile', file);
            });
            var prom = new Promise(function (resolve) {
                $.ajax({
                    url: '/web/binary/upload_attachment',
                    processData: false,
                    contentType: false,
                    type: "POST",
                    enctype: 'multipart/form-data',
                    data: postData,
                    success: function (result) {
                        var matches = []
                        var regex = /(?:id\": )(\d+)/g;
                        var match;
                        while (match = regex.exec(result)) {
                            matches.push(parseInt(match[1]));
                        }
                        return self._createInvoices(matches);
                    },
                    error: function (error) {
                        self.do_notify(_t("Error"), _t("An error occurred during the upload"));
                        resolve();
                    },
                });
            });
            return prom;
        },

        _createInvoices: function(attachent_ids) {
            var self = this;
            return this._rpc({
                model: 'account.invoice.import.wizard',
                method: 'create_invoices',
                args: ["", attachent_ids],
                context: this.initialState.context,
            }).then(function(result) {
                self.do_action(result);
            })
        },
    }
    return UploadBillMixin;
});


odoo.define('account.bills.tree', function (require) {
"use strict";
    var core = require('web.core');
    var ListController = require('web.ListController');
    var ListView = require('web.ListView');
    var UploadBillMixin = require('web.UploadBillMixin');
    var viewRegistry = require('web.view_registry');

    var qweb = core.qweb;

    var BillsListController = ListController.extend(UploadBillMixin, {
        buttons_template: 'BillsListView.buttons',
        events: _.extend({}, ListController.prototype.events, {
            'click .o_button_upload_bill': '_onUpload',
        }),
    });

    var BillsListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: BillsListController,
        }),
    });

    viewRegistry.add('account_tree', BillsListView);
});

odoo.define('account.dashboard.kanban', function (require) {
"use strict";
    var core = require('web.core');
    var KanbanController = require('web.KanbanController');
    var KanbanView = require('web.KanbanView');
    var UploadBillMixin = require('web.UploadBillMixin');
    var viewRegistry = require('web.view_registry');

    var qweb = core.qweb;

    var DashboardKanbanController = KanbanController.extend(UploadBillMixin, {
        buttons_template: 'BillsListView.buttons',
        events: _.extend({}, KanbanController.prototype.events, {
            'click .o_button_upload_bill': '_onUpload',
        }),
    });

    var DashboardKanbanView = KanbanView.extend({
        config: _.extend({}, KanbanView.prototype.config, {
            Controller: DashboardKanbanController,
        }),
    });

    viewRegistry.add('account_dashboard_kanban', DashboardKanbanView);
});
