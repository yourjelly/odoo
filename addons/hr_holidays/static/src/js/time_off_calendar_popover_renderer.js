odoo.define('hr_holidays.dashboard.view_popover_renderer', function(require) {

    var core = require('web.core');
    const config = require('web.config');
    var CalendarRenderer = require("web.CalendarRenderer");
    var TimeOffCalendarPopover = require("hr_holidays.dashboard.view_popover");

    var QWeb = core.qweb;

    var TimeOffPopoverRenderer = CalendarRenderer.extend({
        template: "TimeOff.CalendarView.extend",
        /**
         * We're overriding this to display the weeknumbers on the year view
         *
         * @override
         * @private
         */
        _getFullCalendarOptions: function () {
            const oldOptions = this._super(...arguments);
            // Parameters
            oldOptions.views.dayGridYear.weekNumbers = true;
            oldOptions.views.dayGridYear.weekNumbersWithinDays = false;
            return oldOptions;
        },

        config: _.extend({}, CalendarRenderer.prototype.config, {
            CalendarPopover: TimeOffCalendarPopover,
        }),

        _getPopoverParams: function (eventData) {
            let params = this._super.apply(this, arguments);
            let calendarIcon;
            let state = eventData.extendedProps.record.state;

            if (state === 'validate') {
                calendarIcon = 'fa-calendar-check-o';
            } else if (state === 'refuse') {
                calendarIcon = 'fa-calendar-times-o';
            } else if(state) {
                calendarIcon = 'fa-calendar-o';
            }

            params['title'] = eventData.extendedProps.record.display_name.split(':').slice(0, -1).join(':');
            params['template'] = QWeb.render('hr_holidays.calendar.popover.placeholder', {color: this.getColor(eventData.color_index), calendarIcon: calendarIcon});
            return params;
        },

        _render: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function () {
                self.$el.parent().find('.o_calendar_mini').hide();
            });
        },
        /**
         * @override
         * @private
         */
        _renderCalendar: function() {
            this._super.apply(this, arguments);
            let weekNumbers = this.$el.find('.fc-week-number');
            weekNumbers.each( function() {
                let weekRow = this.parentNode;
                // By default, each month has 6 weeks displayed, hide the week number if there is no days for the week
                if(!weekRow.children[1].classList.length && !weekRow.children[weekRow.children.length-1].classList.length) {
                    this.innerHTML = '';
                }
            });
        },
    });

    return TimeOffPopoverRenderer;
});
