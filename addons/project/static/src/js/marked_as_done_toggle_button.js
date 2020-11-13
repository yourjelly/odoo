odoo.define('project.marked_as_done_toggle_button', function (require) {
"use strict";

const fieldRegistry = require('web.field_registry');
const { FieldToggleBoolean } = require('web.basic_fields');
const { _lt } = require('web.core');

const MarkedAsDoneToggleButton = FieldToggleBoolean.extend({
    /**
     * @override
     * @private
     */
    _render: function () {
        // When the marked_as_done field in project.task is true, then we add a class to the record to mark the task as done.
        const title = this.value ? _lt('Mark task incomplete') : _lt('Mark task complete');
        const name = this._getActionButton();
        const label = this.value ? _lt('Mark task incomplete') : _lt('Mark task complete');

        this.$('i')
            .addClass('fa fa-check-circle-o')
            .removeClass('fa-circle')
            .attr('title', title);

        this.$el
            .addClass('o_mark_as_done_button')
            .toggleClass('o_done_task', this.value)
            .attr('title', title)
            .attr('name', name)
            .attr('aria-label', label)
            .attr('aria-pressed', this.value)
            .attr('type', 'button')
            .attr('role', 'button');
    },
    _onToggleButton: async function (event) {
        const context = this.record.getContext();
        event.stopPropagation();
        await this._rpc({
            model: this.model,
            method: this._getActionButton(),
            context,
            args: [this.res_id]
        });

        this.trigger_up('marked_as_done_changed', {
            id: this.res_id,
            marked_as_done: !this.value
        });

        this._setValue(!this.value);
    },
    /**
     * Get the correct action for the button when the user will click on it.
     * @private
     * @returns the name of the action to call to the backend.
     */
    _getActionButton: function () {
        return this.value ? 'action_mark_as_incomplete' : 'action_mark_as_done';
    },
});

fieldRegistry.add('marked_as_done_toggle_button', MarkedAsDoneToggleButton);

return MarkedAsDoneToggleButton;

});
