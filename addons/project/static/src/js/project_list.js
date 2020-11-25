odoo.define('project.ProjectListView', function (require) {
    "use strict";

    const Dialog = require('web.Dialog');
    const ListModel = require('web.ListModel');
    const ListView = require('web.ListView');
    const ListController = require('web.ListController');
    const ListRenderer = require('web.ListRenderer');
    const core = require('web.core');
    const view_registry = require('web.view_registry');

    const _t = core._t;

    const ProjectListModel = ListModel.extend({
        /**
         * Overridden to fetch extra fields even if `child_ids` is
         * invisible in the view.
         *
         * @override
         * @private
         */
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _fetchRelatedData: function (list, toFetch, fieldName) {
            if (fieldName === 'child_ids') {
                var fieldsInfo = list.fieldsInfo[list.viewType][fieldName];
                // force to fetch extra fields
                fieldsInfo.fields = list.fields;
                fieldsInfo.relatedFields = list.fieldsInfo[list.viewType];
                fieldsInfo.fieldsInfo = list.fieldsInfo;
            }
            return this._super.apply(this, arguments);
        },

        /**
         * Helper method to create datapoints and assign them values, then link
         * those datapoints into records' data.
         *
         * @param {Object[]} records a list of record where datapoints will be
         *   assigned, it assumes _applyX2ManyOperations and _sort have been
         *   already called on this list
         * @param {string} fieldName concerned field in records
         * @param {Object[]} values typically a list of values got from a rpc
         */
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _updateRecordsData: function (records, fieldName, values) {
            if (!records.length || !values) {
                return;
            }
            if(fieldName !== 'child_ids'){
                return this._super.apply(this, arguments);
            }
            var self = this;
            var field = records[0].fields[fieldName];
            var fieldInfo = records[0].fieldsInfo[records[0].viewType][fieldName];
            var view = fieldInfo.views && fieldInfo.views[fieldInfo.mode];
            var fieldsInfo = view ? view.fieldsInfo : fieldInfo.fieldsInfo;
            var viewType = view ? view.type : fieldInfo.viewType;

            var context = records[0].context;
            var fieldNames = records[0].getFieldNames();
            var fields = records[0].fields;            

            _.each(records, function (record) {
                var x2mList = self.localData[record.data[fieldName]];
                x2mList.data = [];

                _.each(x2mList.res_ids, function (res_id) {
                    var dataPoint = self._makeDataPoint({
                        context: context,
                        modelName: field.relation,
                        data: _.findWhere(values, {id: res_id}),
                        fields: fields,
                        fieldsInfo: fieldsInfo,
                        parentID: x2mList.id,
                        viewType: viewType,
                    });

                    self._parseServerData(fieldNames, dataPoint, dataPoint.data);

                    x2mList.data.push(dataPoint.id);
                    x2mList._cache[res_id] = dataPoint.id;
                });
            });
        },

        /**
         * Toggle (open/close) sub task list in a tasks list, then fetches relevant
         * data
         *
         * @param {string} taskId
         * @returns {Promise<string>} resolves to the task id
         */
        /** REFACTOR ABORTED : the purpose was to handle list parent records as groups of a group-by */
        toggleTask: function (taskId) {
            var self = this;
            var task = this.localData[taskId];
            if (task.isOpen) {
                task.isOpen = false;
                task.data = [];
                task.res_ids = [];
                task.offset = 0;
                this._updateParentResIDs(task);
                return Promise.resolve(taskId);
            }
            if (!task.isOpen) {
                task.isOpen = true;
                var def;
                if (task.count > 0) {
                    def = this._load(task).then(function () {
                        self._updateParentResIDs(task);
                    });
                }
                return Promise.resolve(def).then(function () {
                    return taskId;
                });
            }
        },
    })

    const ProjectListController = ListController.extend({
        /** REFACTOR ABORTED : the purpose was to handle list parent records as groups of a group-by */
        custom_events: _.extend({}, ListController.prototype.custom_events, {
            toggle_task: '_onToggleTask',
        }),

        _getActionMenuItems(state) {
            if(!this.archiveEnabled) {
                return this._super(...arguments);
            }

            const recurringRecords = this.getSelectedRecords().filter(rec => rec.data.recurrence_id).map(rec => rec.data.id);
            this.archiveEnabled = recurringRecords.length == 0;
            let actions = this._super(...arguments);
            this.archiveEnabled = true;

            if(actions && recurringRecords.length > 0) {
                actions.items.other.unshift({
                    description: _t('Archive'),
                    callback: () => this._stopRecurrence(recurringRecords, this.selectedRecords, 'archive'),
                }, {
                    description: _t('Unarchive'),
                    callback: () => this._toggleArchiveState(false)
                });
            }
            return actions;
        },

        _onDeleteSelectedRecords() {
            const recurringRecords = this.getSelectedRecords().filter(rec => rec.data.recurrence_id).map(rec => rec.data.id);
            if(recurringRecords.length > 0) {
                return this._stopRecurrence(recurringRecords, this.selectedRecords, 'delete');
            }

            return this._super(...arguments);
        },

        _stopRecurrence(recurring_res_ids, res_ids, mode) {
            let warning;
            if (res_ids.length > 1) {
                warning = _t('It seems that some tasks are part of a recurrence.');
            } else {
                warning = _t('It seems that this task is part of a recurrence.');
            }
            return new Dialog(this, {
                buttons: [
                    {
                        classes: 'btn-primary',
                        click: () => {
                            this._rpc({
                                model: 'project.task',
                                method: 'action_stop_recurrence',
                                args: [recurring_res_ids],
                            }).then(() => {
                                if (mode === 'archive') {
                                    this._toggleArchiveState(true);
                                } else if (mode === 'delete') {
                                    this._deleteRecords(res_ids);
                                }
                            });
                        },
                        close: true,
                        text: _t('Stop Recurrence'),
                    },
                    {
                        click: () => {
                            this._rpc({
                                model: 'project.task',
                                method: 'action_continue_recurrence',
                                args: [recurring_res_ids],
                            }).then(() => {
                                if (mode === 'archive') {
                                    this._toggleArchiveState(true);
                                } else if (mode === 'delete') {
                                    this._deleteRecords(res_ids);
                                }
                            });
                        },
                        close: true,
                        text: _t('Continue Recurrence'),
                    },
                    {
                        close: true,
                        text: _t('Discard'),
                    }
                ],
                size: 'medium',
                title: _t('Confirmation'),
                $content: $('<main/>', {
                    role: 'alert',
                    text: warning,
                }),
            }).open();
        },
        /**
         * In a grouped list view, each group can be clicked on to open/close them.
         * This method just transfer the request to the model, then update the
         * renderer.
         *
         * @private
         * @param {OdooEvent} ev
         */
        /** REFACTOR ABORTED : the purpose was to handle list parent records as groups of a group-by */
        __onToggleTask: function (ev) {
            ev.stopPropagation();
            var self = this;
            this.model
                .toggleTask(ev.data.task.id)
                .then(function () {
                    self.update({}, {keepSelection: true, reload: false}).then(function () {
                        if (ev.data.onSuccess) {
                            ev.data.onSuccess();
                        }
                    });
                });
        },
    });
    const ProjectListRenderer = ListRenderer.extend({
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        events: _.extend({}, ListRenderer.prototype.events, {
            'click .o_task_unfold': '_onToggleUnfold',
        }),
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _onToggleUnfold: function (e){
            e.stopPropagation();
            var task = $(e.currentTarget).closest('tr').data('task_id');
            $('.o_project_subtask').filter(function () {
                return $(this).data('parent_task_id') === task;
            }).toggleClass('o_tree_project_sub_task_hide');
        },
        /**
         * @private
         * @param {DOMEvent} ev
         */
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _onToggleTask: function (ev) {
            ev.preventDefault();
            var task = $(ev.currentTarget).closest('tr').data('task');
            if (task.count) {
                this.trigger_up('toggle_group', {
                    task: task,
                    onSuccess: () => {
                        this._updateSelection();
                        // Refocus the header after re-render unless the user
                        // already focused something else by now
                        if (document.activeElement.tagName === 'BODY') {
                            var groupHeaders = $('tr.o_task_header:data("task")');
                            var header = groupHeaders.filter(function () {
                                return $(this).data('task').id === task.id;
                            });
                            header.find('.o_task_name').focus();
                        }
                    },
                });
            }
        },
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _renderBodyCell: function (record, node, colIndex, options) {
            let $td = this._super.apply(this, arguments);
            let isName = node.attrs["name"] === "name";
            if(isName){
                let hasChildTask = record.data.child_ids.count;
                let isChildTask = record.data.parent_id; // FIXME : not reliable
                if(hasChildTask){
                    // create button
                    let $subTaskButton = $('<a/>');
                    $subTaskButton.addClass('o_task_unfold');
                    $subTaskButton.append($('<i class="fa fa-tasks" role="img"></i>'));
                    // append to content
                    $td.append('&nbsp;').append($subTaskButton);
                } else if(isChildTask){
                    $td.prepend($('<i class="fa fa-tasks" role="img"></i>')).prepend('&#9;');
                }
            }
            return $td;
        },
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _renderSubRows: function(rows, records, field) {
            const dict = {};
            records.map(record => dict[record.id] = record);
            const $list = [];            
            for(let row of rows){
                let record = dict[row.data('id')];
                row.data('task_id', record.data.id);
                $list.push(row);
                const subRows = record.data[field];
                if(subRows && subRows.data.length){
                    for(let subrow of subRows.data){
                        this._renderSubRow($list, this._renderRow(subrow), record.data.id);
                    }
                    this._renderSubRow($list, this._renderEmptyRow(), record.data.id);
                }
            }
            return $list;
        },
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _renderSubRow: function(list, subRow, task_id) {
            subRow.addClass('o_project_subtask');
            subRow.addClass('o_tree_project_sub_task_hide');
            subRow.data('parent_task_id', task_id);
            list.push(subRow)
        },
        /**
         * Render a row, corresponding to a record.
         *
         * @private
         * @returns {jQueryElement} a <tr> element
         */
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _renderRows: function () {
            let $rows = this._super.apply(this, arguments);
            return this._renderSubRows($rows, this.state.data, "child_ids");
        },
        /**
         * Render the content of a given opened group.
         *
         * @private
         * @param {Object} group
         * @param {integer} groupLevel the nesting level (0 for root groups)
         * @returns {jQueryElement} a <tr> element
         */
        /** CHANGE ABORTED : Show subtasks of a task in the list view */
        _renderGroup: function (group, groupLevel) {
            var self = this;
            if (group.groupedBy.length) {
                return self._super.apply(self, arguments);
            } else {
                // the opened group contains records
                let $records = _.map(group.data, function (record) {
                    return self._renderRow(record);
                });
                return [$('<tbody>').append(this._renderSubRows($records, group.data, "child_ids"))];
            }
        },
    });
    
    const ProjectListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: ProjectListController,
            Renderer: ProjectListRenderer,
            Model: ProjectListModel,
        }),
    });

    view_registry.add('project_list', ProjectListView);

    return ProjectListView;
});
