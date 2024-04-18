import { Record } from "./record";

export class UnreadMessageCounter extends Record {
    static id = "thread";
    serverValue = 0;
    serverLastMessageId = null;
    thread = Record.one("Thread");
    value = Record.attr(0, {
        compute() {
            // Messages will be marked as read when discuss is opened with the
            // thread opened. There can be a slight delay between the rpc call
            // and the processing of the `discuss.channel/seen` event. In order
            // to avoid counter flickering, let's assume the server value is 0.
            if (
                this.store.discuss.isActive &&
                this.store.discuss.thread?.eq(this.thread) &&
                !this.thread.selfMember?.isSeenMessageMarkedAsUnread
            ) {
                return 0;
            }
            return this.serverValue + this.getMissingCount();
        },
    });

    /**
     * Return the number of needaction messages missing from the server value.
     */
    getMissingCount() {
        if (!this.thread.selfMember?.seen_message_id || this.serverLastMessageId === null) {
            return 0;
        }
        let count = 0;
        for (const { id, isSelfAuthored } of this.thread.allMessages) {
            if (isSelfAuthored && !this.thread.selfMember.isSeenMessageMarkedAsUnread) {
                continue;
            }
            if (Number.isInteger(id) && id > Math.max(this.serverLastMessageId)) {
                count++;
            }
        }
        return count;
    }
}
UnreadMessageCounter.register();
