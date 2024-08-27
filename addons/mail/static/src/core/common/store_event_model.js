import { Record } from "./record";

export class StoreEvent extends Record {
    static id = "id";

    /** @type {number} */
    id = Record.attr(undefined, {
        onUpdate() {
            switch (this.name) {
                case "discuss.channel/transient_message": {
                    const lastMessageId = this.store.getLastMessageId();
                    const message = this.store.Message.insert(
                        {
                            author: this.store.odoobot,
                            body: this.data,
                            id: lastMessageId + 0.01,
                            is_note: true,
                            is_transient: true,
                            thread: this.thread,
                        },
                        { html: true }
                    );
                    message.thread.messages.push(message);
                    message.thread.transientMessages.push(message);
                    break;
                }
            }
        },
    });
    /** @type {string} */
    name;
    /** @type {any} */
    data;
    thread = Record.one("Thread");
}

StoreEvent.register();
