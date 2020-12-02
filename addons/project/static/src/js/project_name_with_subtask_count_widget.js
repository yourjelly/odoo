odoo.define('project.name_with_subtask_count', function (require) {
    "use strict";

    const fieldRegistry = require('web.field_registry');
    const FieldChar = require('web.basic_fields').FieldChar;
    const _lt = require('web.core')._lt;

    const FieldNameWithSubTaskCount = FieldChar.extend({
        init: function () {
            this._super.apply(this, arguments);
            this.subtaskNbr = this.recordData.child_ids.count;
        },
        _render: function () {
            let result = this._super.apply(this, arguments);
            if (this.subtaskNbr > 0) {
                let subtaskText = _lt(`(+ ${this.subtaskNbr} task${this.subtaskNbr > 1 ? 's' : ''})`);
                this.$el.append($('<span>').addClass("text-muted ml-2").text(subtaskText).css('font-weight', 'normal'));
            }
            return result;
        }
    });

    fieldRegistry.add('name_with_subtask_count', FieldNameWithSubTaskCount);

    return FieldNameWithSubTaskCount;
});
