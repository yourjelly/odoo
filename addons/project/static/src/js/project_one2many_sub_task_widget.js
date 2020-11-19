odoo.define('project.one2many_sub_task', function (require) {
    "use strict";
    
    const fieldRegistry = require('web.field_registry');
    const FieldOne2Many = require('web.relational_fields').FieldOne2Many;
    
    const FieldOne2ManySubTask = FieldOne2Many.extend({
        template: "one2many_sub_task_widget",
    });
    
    fieldRegistry.add('one2many_sub_task', FieldOne2ManySubTask);
    
    return FieldOne2ManySubTask;
    
});
