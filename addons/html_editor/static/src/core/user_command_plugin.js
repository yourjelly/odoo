import { Plugin } from "../plugin";

/**
 * @typedef { Object } UserCommandShared
 * @property { UserCommandPlugin['run'] } run
 * @property { UserCommandPlugin['getCommands'] } getCommands
 */
export class UserCommandPlugin extends Plugin {
    static id = "userCommand";
    static shared = ["run", "getCommands"];

    setup() {
        this.commands = {};
        for (const command of this.getResource("user_commands")) {
            if (command.id in this.commands) {
                throw new Error(`Duplicate user command id: ${command.id}`);
            }
            this.commands[command.id] = command;
        }
    }

    run(commandId, params) {
        const command = this.commands[commandId];
        if (!command) {
            throw new Error(`Unknown user command id: ${commandId}`);
        }
        return command.run(params);
    }

    getCommands() {
        return this.commands;
    }
}
