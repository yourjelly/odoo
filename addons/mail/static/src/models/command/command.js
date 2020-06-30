odoo.define('mail/static/src/models/command/command.js', function (require) {
'use strict';

const { registerNewModel } = require('mail/static/src/model/model_core.js');
const { attr } = require('mail/static/src/model/model_field.js');

function factory(dependencies) {

    class Command extends dependencies['mail.model'] {}

    Command.fields = {
        channel_types: attr(),
        help: attr(),
        name: attr(),
    };

    Command.modelName = 'mail.command';

    return Command;
}

registerNewModel('mail.command', factory);

});
