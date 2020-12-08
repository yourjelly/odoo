odoo.define('project.project_kanban', function (require) {
'use strict';

var KanbanController = require('web.KanbanController');
var KanbanView = require('web.KanbanView');
var KanbanRenderer = require('web.KanbanRenderer');
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

var ProjectKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Controller: ProjectKanbanController
    }),
});

const ProjectOrderKanbanRenderer = KanbanRenderer.extend({
    _renderUngrouped: function (fragment) {
        this.state.data = _.sortBy(this.state.data, (record) => {return record.data.is_favorite;}).reverse();
        this._super.apply(this, arguments);
    }
})

const ProjectOrderKanbanView = KanbanView.extend({
    config: _.extend({}, KanbanView.prototype.config, {
        Renderer: ProjectOrderKanbanRenderer
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
view_registry.add('project_order_kanban', ProjectOrderKanbanView);

return ProjectKanbanController;
});
