odoo.define('pos_invoice.models', function (require) {
    'use strict';

    var models = require('point_of_sale.models');

    models.load_fields('pos.payment.method', ['bank_journal_id', 'cash_journal_id']);
});
