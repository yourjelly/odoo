odoo.define('project.ProjectListView', function (require) {
    "use strict";

    const Dialog = require('web.Dialog');
    const ListView = require('web.ListView');
    const ListController = require('web.ListController');
    const ListRenderer = require('web.ListRenderer');
    const core = require('web.core');
    const view_registry = require('web.view_registry');

    const _t = core._t;

    const ProjectListController = ListController.extend({
        custom_events: _.extend({}, ListController.prototype.custom_events, {
            'marked_as_done_changed': '_onMarkedAsDoneChanged'
        }),
        /**
         * When the marked_as_done_toggle_button is clicked, we reload the view to see the updating.
         * @param {Object} event
         */
        _onMarkedAsDoneChanged: function (event) {
            this.reload();
        },

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
        }
    });

    const ProjectListRenderer = ListRenderer.extend({
        _renderRow: function (record) {
            const $tr = this._super.apply(this, arguments);
            if (record.data.hasOwnProperty('marked_as_done') && record.data.marked_as_done) {
                $tr.addClass('o_done_task'); // XBO TODO: add style when the task is done
            }
            return $tr;
        }
    });

    const ProjectListView = ListView.extend({
        config: _.extend({}, ListView.prototype.config, {
            Controller: ProjectListController,
            Renderer: ProjectListRenderer,
        }),
    });

    view_registry.add('project_list', ProjectListView);

    return ProjectListView;
});
