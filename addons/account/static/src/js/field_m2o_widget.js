// odoo.define('account.search_more_multi_select_widget', function (require) {
//     "use strict";

//     var core = require('web.core');
//     var relationalFields = require('web.relational_fields');

//     var _t = core._t;
//     var FieldMany2One = relationalFields.FieldMany2One;

//     var FieldM2oMultiSelect = FieldMany2One.extend({
//         _getSearchCreatePopupOptions: function(view, ids, context, dynamicFilters) {
//             var self = this;
//             return {
//                 res_model: this.field.relation,
//                 domain: this.record.getDomain({fieldName: this.name}),
//                 context: _.extend({}, this.record.getContext(this.recordParams), context || {}),
//                 dynamicFilters: dynamicFilters || [],
//                 title: (view === 'search' ? _t("Search: ") : _t("Create: ")) + this.string,
//                 initial_ids: ids,
//                 initial_view: view,
//                 disable_multiple_selection: false,
//                 no_create: !self.can_create,
//                 kanban_view_ref: this.attrs.kanban_view_ref,
//                 on_selected: function (records) {
//                     var prom = self._rpc({
//                         model: 'sale.order',
//                         method: 'create_so_lines',
//                         args: [self.getParent().getParent().res_id,records.map(rec => rec.id)],
//                     });
//                     Promise.resolve(prom).then(function (results) {
//                         console.log(">>>>>>>>results",results);
//                         debugger;
//                         this.getParent().getParent().trigger_up('field_changed', {
//                             dataPointID: ev.data.dataPointID,
//                             changes: {
//                                 product_id: {id: result.product_id},
//                             },
//                         });
//                     });
//                 },
//                 on_closed: function () {
//                     self.activate();
//                 },
//             };
//         },
//     });

//     fieldRegistry.add('search_more_multi_select', FieldM2oMultiSelect)
// });
