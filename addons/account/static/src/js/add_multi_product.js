odoo.define('sale.add_multi_product', function (require) {
var relationalFields = require('web.relational_fields');
var FieldsRegistry = require('web.field_registry');

var addMultiProductWidget = relationalFields.FieldMany2One.extend({
    /**
     * Prepares and returns options for SelectCreateDialog
     *
     * @private
     */
    _getSearchCreatePopupOptions: function () {
        const res = this._super.apply(this, arguments);
        res.disable_multiple_selection = false;
        res.on_selected = records => {
            var parentList = this.getParent().getParent();
            this.getParent().unselectRow();
            var productIds = _.map(records, rec => {
                return {default_product_id: rec.id};
            });
            parentList.trigger_up('field_changed', {
                dataPointID: parentList.dataPointID,
                changes: {
                    order_line: {
                        operation: 'MULTI',
                        commands: [{
                            operation: 'CREATE',
                            context: productIds
                        }]
                    }
                }
            });
        };
        return res;
    },
});

FieldsRegistry.add('add_multi_product', addMultiProductWidget);

});
