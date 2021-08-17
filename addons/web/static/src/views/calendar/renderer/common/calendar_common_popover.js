/** @odoo-module **/

import { localization } from "@web/core/l10n/localization";
import LegacyCalendarPopover from "web.CalendarPopover";
import { ComponentAdapter } from "web.OwlCompatibility";
import * as legacyEnv from "web.env";

const { Component } = owl;

////////////////////////////////////////////////////////////////////////////////
/** @todo: should be rewritten when the new fields API is ready              **/
////////////////////////////////////////////////////////////////////////////////
function convertRecordToEvent(record) {
    return {
        id: record.id,
        title: record.title,
        start: record.start.toLocal().toJSDate(),
        end: record.end.toLocal().toJSDate(),
        allDay: record.isAllDay,
        extendedProps: {
            record: record.rawRecord,
            colorIndex: record.colorIndex,
        },
    };
}

class CalendarPopoverAdapter extends ComponentAdapter {
    setup() {
        this.env = legacyEnv;
    }
    get widgetArgs() {
        const popoverFields = {};
        for (const key in this.props.popoverFields) {
            popoverFields[key] = { attrs: this.props.popoverFields[key] };
        }

        return [
            {
                hideDate: this.props.isDateHidden,
                hideTime: this.props.isTimeHidden,
                eventTime: {
                    time: this.props.time,
                    duration: this.props.timeDuration,
                },
                eventDate: {
                    date: this.props.date,
                    duration: this.props.dateDuration,
                },
                displayFields: popoverFields,
                fields: this.props.fields,
                event: convertRecordToEvent(this.props.record),
                modelName: this.props.resModel,
                canDelete: this.props.canDelete,
                popoverFields,
            },
        ];
    }
}
////////////////////////////////////////////////////////////////////////////////

export class CalendarCommonPopover extends Component {
    setup() {
        this.Widget = LegacyCalendarPopover;

        this.time = null;
        this.timeDuration = null;
        this.date = null;
        this.dateDuration = null;

        this.computeDateTimeAndDuration();
    }

    computeDateTimeAndDuration() {
        const start = this.props.record.start.toLocal();
        const end = this.props.record.end.toLocal();
        const isSameDay = start.hasSame(end, "day");

        if (!this.props.record.isTimeHidden && !this.props.record.isAllDay && isSameDay) {
            const timeFormat = localization.timeFormat.search("HH") !== -1 ? "HH:mm" : "hh:mm a";
            this.time = `${start.toFormat(timeFormat)} - ${end.toFormat(timeFormat)}`;

            const duration = end.diff(start, ["hours", "minutes"]);
            const formatParts = [];
            if (duration.hours > 0) {
                formatParts.push(
                    `h '${duration.hours === 1 ? this.env._t("hour") : this.env._t("hours")}'`
                );
            }
            if (duration.minutes > 0) {
                formatParts.push(
                    `m '${duration.minutes === 1 ? this.env._t("minute") : this.env._t("minutes")}'`
                );
            }
            this.timeDuration = duration.toFormat(formatParts.join(", "));
        }

        if (!this.props.model.isDateHidden) {
            this.date = this.getFormattedDate(start, end);

            if (this.props.record.isAllDay) {
                if (isSameDay) {
                    this.dateDuration = this.env._t("All day");
                } else {
                    const duration = end.diff(start, "days");
                    this.dateDuration = duration.toFormat(
                        `d '${duration.days === 1 ? this.env._t("day") : this.env._t("days")}'`
                    );
                }
            }
        }
    }
    /**
     * Returns event's formatted date for popovers.
     *
     * @param {luxon.DateTime} start
     * @param {luxon.DateTime} end
     */
    getFormattedDate(start, end) {
        const isSameDay = start.hasSame(end, "days");
        if (!isSameDay && start.hasSame(end, "month")) {
            // Simplify date-range if an event occurs into the same month (eg. "4-5 August 2019")
            return start.toFormat("LLLL d") + "-" + end.toFormat("d, y");
        } else {
            return isSameDay
                ? start.toFormat("DDDD")
                : start.toFormat("DDD") + " - " + end.toFormat("DDD");
        }
    }

    close() {
        this.trigger("popover-closed");
    }

    onEditEvent() {
        this.props.editRecord(this.props.record);
        this.close();
    }
    onDeleteEvent() {
        this.props.deleteRecord(this.props.record);
        this.close();
    }
}
CalendarCommonPopover.components = { CalendarPopoverAdapter };
CalendarCommonPopover.template = "web.CalendarCommonPopover";
CalendarCommonPopover.props = {
    record: Object,
    model: Object,
    createRecord: Function,
    deleteRecord: Function,
    editRecord: Function,
};
