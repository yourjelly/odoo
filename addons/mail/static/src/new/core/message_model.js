/* @odoo-module */

import { htmlToTextContentInline } from "@mail/new/utils/format";

import { toRaw } from "@odoo/owl";

import { _t } from "@web/core/l10n/translation";
import { url } from "@web/core/utils/urls";
import { deserializeDateTime } from "@web/core/l10n/dates";
import { createLocalId } from "./thread_model.create_local_id";

const { DateTime } = luxon;

export class Message {
    /** @type {Object[]} */
    attachments = [];
    /** @type {Persona} */
    author;
    /** @type {string} */
    body;
    /** @type {number|string} */
    id;
    /** @type {boolean} */
    isDiscussion;
    /** @type {boolean} */
    isNote;
    /** @type {boolean} */
    isStarred;
    /** @type {boolean} */
    isTransient;
    /** @type {LinkPreview[]} */
    linkPreviews = [];
    /** @type {number[]} */
    needaction_partner_ids = [];
    /** @type {number[]} */
    history_partner_ids = [];
    /** @type {Message|undefined} */
    parentMessage;
    /** @type {MessageReactions[]} */
    reactions = [];
    /** @type {Notification[]} */
    notifications = [];
    /** @type {number|string} */
    resId;
    /** @type {string|undefined} */
    resModel;
    /** @type {Number[]} */
    starred_partner_ids = [];
    /** @type {string} */
    subject;
    /** @type {string} */
    subtypeDescription;
    /** @type {Object[]} */
    trackingValues = [];
    /** @type {string} */
    type;
    now = DateTime.now();
    /** @type {import("@mail/new/core/store_service").Store} */
    _store;

    /**
     * @returns {boolean}
     */
    get canBeEdited() {
        if (this.isEmpty) {
            return false;
        }
        if (!this._store.user.isAdmin && !this.isAuthoredByCurrentUser) {
            return false;
        }
        if (this.type !== "comment") {
            return false;
        }
        return this.isNote || this.resModel === "mail.channel";
    }

    get dateDay() {
        let dateDay = this.dateTime.toLocaleString(DateTime.DATE_FULL);
        if (dateDay === DateTime.now().toLocaleString(DateTime.DATE_FULL)) {
            dateDay = _t("Today");
        }
        return dateDay;
    }

    get dateTime() {
        return toRaw(this.date ? deserializeDateTime(this.date) : this.now);
    }

    get dateTimeSimpleStr() {
        return this.dateTime.toLocaleString(DateTime.TIME_SIMPLE);
    }

    get dateTimeStr() {
        return this.dateTime.toLocaleString(DateTime.DATETIME_SHORT);
    }

    get isAuthoredByCurrentUser() {
        if (!this.author) {
            return false;
        }
        if (this._store.currentGuest) {
            return this.author.guest?.id === this._store.currentGuest.id;
        }
        return this.author.partner?.id === this._store.user.partnerId;
    }

    get isNeedaction() {
        return this.needaction_partner_ids.includes(this._store.user.partnerId);
    }

    /**
     * @returns {boolean}
     */
    get isHistory() {
        return this.history_partner_ids.includes(this._store.user.partnerId);
    }

    /**
     * @returns {boolean}
     */
    get isNotification() {
        return this.type === "notification" && this.resModel === "mail.channel";
    }

    get isSubjectSimilarToOriginThreadName() {
        if (!this.subject || !this.originThread || !this.originThread.name) {
            return false;
        }
        const cleanedThreadName = this.originThread.name.trim().toLowerCase();
        const cleanedSubject = this.subject.trim().toLowerCase();
        if (cleanedSubject === cleanedThreadName) {
            return true;
        }
        if (!cleanedSubject.endsWith(cleanedThreadName)) {
            return false;
        }
        const subjectWithoutThreadName = cleanedSubject.slice(
            0,
            cleanedSubject.indexOf(cleanedThreadName)
        );
        const prefixList = ["re", "fw", "fwd"];
        // match any prefix as many times as possible
        const isSequenceOfPrefixes = new RegExp(`^((${prefixList.join("|")}):\\s*)+$`);
        return isSequenceOfPrefixes.test(subjectWithoutThreadName);
    }

    get originThread() {
        return this._store.threads[createLocalId(this.resModel, this.resId)];
    }

    get url() {
        return `${url("/web")}#model=${this.resModel}&id=${this.id}`;
    }

    get isBodyEmpty() {
        return (
            !this.body ||
            ["", "<p></p>", "<p><br></p>", "<p><br/></p>"].includes(this.body.replace(/\s/g, ""))
        );
    }

    get isEmpty() {
        return (
            this.isBodyEmpty &&
            this.attachments.length === 0 &&
            this.trackingValues.length === 0 &&
            !this.subtypeDescription
        );
    }

    get inlineBody() {
        return htmlToTextContentInline(this.body);
    }

    get failureNotifications() {
        return this.notifications.filter((notification) => notification.isFailure);
    }
}
