import { Record } from "./record";

/**
 * @abstract
 */
export class ThreadCounter extends Record {
    static id = "thread";
    name;
    serverValue = 0;
    serverLastMessageId = null;
    thread = Record.one("Thread");
    value = Record.attr(0, {
        compute() {
            return this.serverValue + this.getMissingCount();
        },
    });

    /**
     * @returns {number} number of messages that are missing from the server
     * value.
     */
    getMissingCount() {
        throw new Error("Abstract method should be implemented by subclasses");
    }
}

export class UnreadMessageCounter extends ThreadCounter {
    /**
     * Return the number of needaction messages missing from the server value.
     */
    getMissingCount() {
        if (!this.thread.selfMember.seen_message_id || this.serverLastMessageId === null) {
            return 0;
        }
        let count = 0;
        for (const { id } of this.thread.allMessages) {
            if (Number.isInteger(id) && id > this.serverLastMessageId) {
                count++;
            }
        }
        return count;
    }
}
UnreadMessageCounter.register();
