odoo.define('hr_holidays.dashboard.view_popover', function(require) {

    var core = require('web.core');
    var CalendarPopover = require('web.CalendarPopover');
    
    var _t = core._t;
    
    var TimeOffCalendarPopover = CalendarPopover.extend({
        template: 'hr_holidays.calendar.popover',

        init: function (parent, eventInfo) {
            this._super.apply(this, arguments);
            const state = this.event.extendedProps.record.state;
            this.canDelete = state && ['validate', 'refuse'].indexOf(state) === -1;
            this.canEdit = state !== undefined;
            this.displayFields = [];

            if (this.modelName === "hr.leave.report.calendar") {
                const duration = this.event.extendedProps.record.display_name.split(':').slice(-1);
                this.display_name = _.str.sprintf(_t("Time Off : %s"), duration);
            } else {
                this.display_name = this.event.extendedProps.record.display_name;
            }
        },
    });

    return TimeOffCalendarPopover;
});
