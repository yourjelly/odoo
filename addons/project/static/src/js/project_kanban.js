odoo.define('project.project_kanban', function (require) {
'use strict';

var KanbanController = require('web.KanbanController');
var KanbanRenderer = require('web.KanbanRenderer');
var KanbanView = require('web.KanbanView');
var KanbanColumn = require('web.KanbanColumn');
var view_registry = require('web.view_registry');
var KanbanRecord = require('web.KanbanRecord');

KanbanRecord.include({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @override
     * @private
     */
     // YTI TODO: Should be transformed into a extend and specific to project
    _openRecord: function () {
        if (this.modelName === 'project.project' && this.$(".o_project_kanban_boxes a").length) {
            this.$('.o_project_kanban_boxes a').first().click();
        } else {
            this._super.apply(this, arguments);
        }
    },
});

var ProjectKanbanController = KanbanController.extend({
    custom_events: _.extend({}, KanbanController.prototype.custom_events, {
        'kanban_column_delete_wizard': '_onDeleteColumnWizard',
    }),

    _onDeleteColumnWizard: function (ev) {
        ev.stopPropagation();
        const self = this;
        const column_id = ev.target.id;
        var state = this.model.get(this.handle, {raw: true});
        this._rpc({
            model: 'project.task.type',
            method: 'unlink_wizard',
            args: [column_id],
            context: state.getContext(),
        }).then(function (res) {
            self.do_action(res);
        });
    }
});

const ProjectTaskKanbanRecord = KanbanRecord.extend({
    custom_events: _.extend({}, KanbanRecord.prototype.custom_events, {
        'marked_as_done_changed': '_onMarkedAsDoneChanged'
    }),
    _render: function () {
        const promises = this._super.apply(this, arguments);
        if (this.recordData.hasOwnProperty('marked_as_done') && this.recordData.marked_as_done) {
            this.$el.addClass('o_done_task'); // XBO TODO: add style when the task is done
        }
        return promises;
    },
    /**
     * When the marked_as_done_toggle_button is clicked, we reload the view to see the updating.
     * @param {Object} event
     */
    _onMarkedAsDoneChanged: function (event) {
        event.stopPropagation();
        this._render();
    }
});

const ProjectTaskKanbanRenderer = KanbanRenderer.extend({
    config: Object.assign({}, KanbanRenderer.prototype.config, {
        KanbanRecord: ProjectTaskKanbanRecord,
    }),
});

var ProjectKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Controller: ProjectKanbanController,
        Renderer: ProjectTaskKanbanRenderer
    }),
});

KanbanColumn.include({
    _onDeleteColumn: function (event) {
        event.preventDefault();
        if (this.modelName === 'project.task') {
            this.trigger_up('kanban_column_delete_wizard');
            return;
        }
        this._super.apply(this, arguments);
    }
});

view_registry.add('project_kanban', ProjectKanbanView);

return ProjectKanbanController;
});
