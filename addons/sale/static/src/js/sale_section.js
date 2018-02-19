odoo.define('sale.sales_section_list', function (require) {
"use strict";
var BasicModel = require('web.BasicModel');
var basicFields = require('web.basic_fields');
var core = require('web.core');
var dialogs = require('web.view_dialogs');
var field_registry = require('web.field_registry');
var FormController = require('web.FormController');
var KanbanRenderer = require('web.KanbanRenderer');
var ListRenderer = require('web.ListRenderer');
var relational_fields = require('web.relational_fields');


var _t = core._t;
BasicModel.include({
    /**
     * This method return dummy record it will use for calculate intermediate
     * section subtotal
     *
     * @returns {Deferred} resolves with dummy record
     */
    _makeDummyRecord: function () {
        var def = $.Deferred();
        var self  = this;
        this.makeRecord('dummy.model', [{
                name: 'sub_total',
                type: "float",
            }
        ]).then(function (RecordId){
            var Record = self.get(RecordId);
            def.resolve(Record);
        });
        return def;
    },
    /**
     * Fetches all the relation records associated to the given sections
     *
     * @param {Object} record - an element from the localData
     * @param {String} name - the name of the field
     * @param {Object} fieldInfo - fieldInfo related to record
     * @returns {Deferred<any>}
     *          The deferred is resolved with dummy record and fetch special data related to
     *          all section
     */
    _fetchSpecialSection: function (record, name, fieldInfo) {
        var self = this;
        var sectionField = fieldInfo.sectionBy;
        var sectionDataPoint = [];
        var lines = this.get(record.data[name]) || [];
        _.each(lines.data, function (line) {
            if (line.data[sectionField]) {
                sectionDataPoint.push(line.data[sectionField]);
            }
        });
        var defAll = [this._makeDummyRecord()];
        var res_ids = _.uniq(_.pluck(sectionDataPoint, 'res_id'));
        if (res_ids.length){
            var list = _.first(sectionDataPoint);
            var def = self._rpc({
                model: list.model,
                method: 'read',
                args: [res_ids, []],
                context: list.getContext(),
            }).then(function (res) {
                _.each(sectionDataPoint, function (section) {
                    var dataPoint = self.localData[section.id];
                    dataPoint.specialData[sectionField] = _.findWhere(res, {id: section.res_id});
                });
            });
            defAll.push(def);
        }
        return $.when.apply($, defAll);
    }
});

FormController.include({
    custom_events: _.extend({}, FormController.prototype.custom_events, {
        'set_context': '_onSetContext',
    }),
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {OdooEvent} event
     * @param {string} event.data.id datapointID
     * @param {Object} event.data.context context to set on record
     *
     * */
    _onSetContext: function (event) {
        var record = this.model.localData[event.data.id];
        record.context = _.extend(record.context, event.data.context);
    }
});

var ListSectionRenderer = ListRenderer.extend({
    events: _.extend({}, ListRenderer.prototype.events, {
        'click a.o_field_x2many_list_section_add': '_onAddSection',
        'click a.o_field_x2many_list_row_add': '_onAddRecord'
    }),
    /**
     * @override
     * @param {Object} params
     * @param {boolean} params.sectionField
     * @param {boolean} params.dummyTotalRecord
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.sectionField = params.sectionField;
        this.dummyTotalRecord = params.dummyTotalRecord;
    },
    /**
     * Render section subtotal row. subtotal is monetary field so make total of
     * all section and render it with monetary widget and append it to td
     *
     * @param {Array}  list array of records which belongs to the same section
     * @returns {jQueryElement} a jquery element <tr>
     */
    _renderSectionTotal: function (list) {
        var $td = $('<td>&nbsp;</td>')
            .attr('colspan', this._getNumberOfCols())
            .text(_t("SubTotal: "));
        this.dummyTotalRecord.data = {
            sub_total: _.reduce(list, function (memo, el) {
                 return memo + el.data.price_total;
             }, 0),
            currency_id: _.first(list).data.currency_id
        };
        var monetryWidget = new basicFields.FieldMonetary(this, 'sub_total', this.dummyTotalRecord, {
                mode: 'readonly',
                viewType: 'list',
                attrs : {
                    widget: 'monetary'
                }
            });
        monetryWidget.appendTo($td);
        return $('<tr>', { class: 'o_data_total text-right'}).append($td.wrapInner("<strong>"));
    },
    /**
     * Render section row.
     *
     * @param {Array}  list array of all sections datapoints
     * @returns {jQueryElement} a jquery element <tr>
     */
    _renderSection: function (section) {
        var text = section ? section.data.display_name : _t('Undefined');
        var $td = $('<td>&nbsp;</td>')
            .attr('colspan', this._getNumberOfCols())
            .text(text);
        var sectionId = section.data ? section.data.id : false;
        return $('<tr>', { class: 'o_data_section'}).data('section_id', sectionId).append($td.wrapInner("<strong>"));
    },
    /**
     * ideally groupby section should be done by model
     * but we don't want to change this.state.data structure otherwise we need change all datapoint with section attribute
     * so shamelessly it done here at renderer
     *
     * @param {String}  fieldName section by field anme
     * @returns {Array} [Section, [Row]] array of secetion by it's rows
     *
     * */
    _getSections: function (fieldName) {
        var sections = {};
        return _.chain(this.state.data)
            .groupBy(function (line) {
                var data = line.data[fieldName].data;
                var id = data ? data.id : false;
                sections[id] = line.data[fieldName];
                return id;
            })
            .map(function (list, id) {
                return [sections[id], list];
            })
            .value();
    },
    /**
     *  Override renderRows to add addition rows for section and subtotal
     *
     * @override
     */
    _renderRows: function () {
        var self = this;
        var sections = this._getSections(this.sectionField);
        var list_data = [];
        var rows = [];

        _.each(sections, function (el) {
            var section = el[0];
            var list = el[1];

            rows.push(self._renderSection(section));
            rows.push(_.map(list, self._renderRow.bind(self)));
            var specialData = section && section.specialData[self.sectionField];
            if (specialData && specialData.subtotal || specialData === false){
                rows.push(self._renderSectionTotal(list));
            }
            list_data.push(list);
        });
        this.state.data = _.flatten(list_data);
        if (this.addCreateLine) {
            var $item = $('<a href="#">')
                    .addClass('o_field_x2many_list_row_add')
                    .text(_t("Add an item"));

            var $section = $('<a href="#">')
                    .addClass('o_field_x2many_list_section_add ml16')
                    .text(_t("Add a section"));

            var $td = $('<td>')
                        .attr('colspan', this._getNumberOfCols())
                        .append([$item, $section]);

            var $tr = $('<tr>').append($td);
            rows.push($tr);
        }
        return _.flatten(rows);
    },
    /**
     * there is no appropriate hook to override it partially with _super so rewrite
     * entire method
     *
     * @override
     */
    _resequence: function (event, ui) {
        var self = this;
        var movedRecordID = ui.item.data('id');
        var rows = this.state.data;
        var row = _.findWhere(rows, {id: movedRecordID});
        var $row_sections = ui.item.prevAll('tr.o_data_section');

        var $section = $row_sections.first();
        var sectionID = $section.data('section_id');
        var sectionChange = {};
        sectionChange[this.sectionField] = {
            id: sectionID
        };

        var index0 = rows.indexOf(row);
        var index1 = ui.item.index() - $row_sections.length;
        var lower = Math.min(index0, index1);
        var upper = Math.max(index0, index1) + 1;

        var order = _.findWhere(self.state.orderedBy, {name: self.handleField});
        var asc = !order || order.asc;
        var reorderAll = false;
        var sequence = (asc ? -1 : 1) * Infinity;

        // determine if we need to reorder all lines
        _.each(rows, function (row, index) {
            if ((index < lower || index >= upper) &&
                ((asc && sequence >= row.data[self.handleField]) ||
                 (!asc && sequence <= row.data[self.handleField]))) {
                reorderAll = true;
            }
            sequence = row.data[self.handleField];
        });

        if (reorderAll) {
            rows = _.without(rows, row);
            rows.splice(index1, 0, row);
        } else {
            rows = rows.slice(lower, upper);
            rows = _.without(rows, row);
            if (index0 > index1) {
                rows.unshift(row);
            } else {
                rows.push(row);
            }
        }

        var sequences = _.pluck(_.pluck(rows, 'data'), self.handleField);
        var rowIDs = _.pluck(rows, 'id');

        if (!asc) {
            rowIDs.reverse();
        }
        this.unselectRow().then(function () {
            self.trigger_up('resequence', {
                rowIDs: rowIDs,
                offset: _.min(sequences),
                handleField: self.handleField,
                sectionChange: sectionChange,
                recordId : movedRecordID
            });
        });
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * This method is called when we click on the 'Add Section' button in a sub
     *
     */
    _onAddSection: function (event) {
        event.preventDefault();
        var self = this;
        this.unselectRow().then(function () {
            self.trigger_up('add_section');
        });
    },
});

var SaleOrderLine = relational_fields.FieldOne2Many.extend({
    custom_events: _.extend({}, relational_fields.FieldOne2Many.prototype.custom_events, {
        add_section: '_onAddSection',
    }),
    specialData: "_fetchSpecialSection",
    /**
     * @override
     * @param {boolean} params.sectionField
     */
    init: function () {
        this._super.apply(this, arguments);
        this.sectionField = this.attrs.sectionBy || false;
    },
    /**
     * for group by section at the time of add a new record, record should be added
     * blow it's own section despite of position top or bottom.
     * We don't want to call reset of `FieldOne2Many` but still need to reset call of 'FieldX2Many' and
     * it's ancestors.
     *
     * @override
     * @param {Object} record
     * @param {OdooEvent} [ev] an event that triggered the reset action
     * @returns {Deferred}
     */
    reset: function (record, ev) {
        var self = this;
        if (ev && ev.data.changes[this.name] && ev.data.changes[this.name].section && this.editable){
            var values =  record.data[this.name].data;
            var index = this.editable === 'top' ? 0 : values.length - 1;
            var newID = values[index].id;
            return relational_fields.FieldX2Many.prototype.reset.apply(this, arguments).then(function () {
                self.renderer.editRecord(newID);
            });
        }
        return this._super.apply(this, arguments);
    },
    /**
     * there is no hook to override `ListRenderer` so rewrite entire method
     *
     * @override
     */
    _render: function () {
        if (!this.view) {
            return this._super();
        }
        if (this.renderer) {
            this.currentColInvisibleFields = this._evalColumnInvisibleFields();
            this.renderer.updateState(this.value, {'columnInvisibleFields': this.currentColInvisibleFields});
            this.pager.updateState({ size: this.value.count });
            return $.when();
        }
        var arch = this.view.arch;
        var viewType;
        if (arch.tag === 'tree') {
            viewType = 'list';
            this.currentColInvisibleFields = this._evalColumnInvisibleFields();
            this.renderer = new ListSectionRenderer(this, this.value, {
                arch: arch,
                editable: this.mode === 'edit' && arch.attrs.editable,
                addCreateLine: !this.isReadonly && this.activeActions.create,
                addTrashIcon: !this.isReadonly && this.activeActions.delete,
                isMany2Many: this.isMany2Many,
                viewType: viewType,
                columnInvisibleFields: this.currentColInvisibleFields,
                sectionField: this.sectionField,
                dummyTotalRecord: this.record.specialData[this.name]
            });
        }
        if (arch.tag === 'kanban') {
            viewType = 'kanban';
            var record_options = {
                editable: false,
                deletable: false,
                read_only_mode: this.isReadonly,
            };
            this.renderer = new KanbanRenderer(this, this.value, {
                arch: arch,
                record_options: record_options,
                viewType: viewType,
            });
        }
        this.$el.addClass('o_field_x2many o_field_x2many_' + viewType);
        return this.renderer ? this.renderer.appendTo(this.$el) : this._super();
    },
    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
    *  this handler call from the 'Add Section' link in the list editable renderer
    */
    _onAddSection: function () {
        var self = this;
        var context = this.record.getContext(this.recordParams);
        new dialogs.FormViewDialog(self, {
            res_model: this.view.fields[this.sectionField].relation,
            res_id: self.value.res_id,
            context: context,
            title: _t("Add Section"),
            disable_multiple_selection: true,
            on_saved: function (record, changed) {
                if (changed) {
                    self.creatingRecord = true;
                    context = {};
                    context['default_'+ self.sectionField] = record.res_id;
                    self.trigger_up('set_context', {
                        id: self.value.id,
                        context: context
                    });
                    self.trigger_up('freeze_order', {id: self.value.id});
                    self._setValue({
                        operation: 'CREATE',
                        position: self.editable,
                        section: true,
                    }).always(function () {
                        self.creatingRecord = false;
                    });
                }
            },
        }).open();
    },
    /**
     * when create new record added extra parameter section on _setValue at 
     * handle it upstream. this method also could not be override partially so rewrite entirely
     *
     * @override
     * @private
     * @param {OdooEvent} ev this event come from the 'Add
     *   record' link in the list editable renderer
     */
    _onAddRecord: function (ev) {
        var self = this;
        // we don't want interference with the components upstream.
        ev.stopPropagation();

        if (this.editable) {
            if (!this.activeActions.create) {
                if (ev.data.onFail) {
                    ev.data.onFail();
                }
            } else if (!this.creatingRecord) {
                this.creatingRecord = true;
                this.trigger_up('freeze_order', {id: this.value.id});
                this._setValue({
                    operation: 'CREATE',
                    position: this.editable,
                    section: true,
                }).always(function () {
                    self.creatingRecord = false;
                });
            }
        } else {
            this._openFormDialog({
                on_saved: function (record) {
                    self._setValue({ operation: 'ADD', id: record.id });
                },
            });
        }
    },
    /**
     * override resequence to change section id on drag and drop
     * @@override
     * @param {OdooEvent} event
     */
    _onResequence: function (event) {
        event.stopPropagation();
        var self = this;
        this.trigger_up('freeze_order', {id: this.value.id});
        var rowIDs = event.data.rowIDs.slice();
        var rowID = rowIDs.pop();
        var defs = _.map(rowIDs, function (rowID, index) {
            var data = {};
            data[event.data.handleField] = event.data.offset + index;
            return self._setValue({
                operation: 'UPDATE',
                id: rowID,
                data: data,
            }, {
                notifyChange: false,
            });
        });
        //  change section stage
        var def = self._setValue({
            operation: 'UPDATE',
            id: event.data.recordId,
            data: event.data.sectionChange,
        }, {
            notifyChange: true,
        });
        defs.push(def);
        $.when.apply($, defs).then(function () {
            // trigger only once the onchange for parent record
            self._setValue({
                operation: 'UPDATE',
                id: rowID,
                data: _.extend(_.object([event.data.handleField], [event.data.offset + rowIDs.length]))
            }).always(function () {
                self.trigger_up('toggle_column_order', {
                    id: self.value.id,
                    name: event.data.handleField,
                });
            });
        });
    },
});


field_registry.add('sale_section_list', SaleOrderLine);


});