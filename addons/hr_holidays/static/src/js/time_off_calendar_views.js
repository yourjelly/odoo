odoo.define('hr_holidays.dashboard.views', function(require) {
    'use strict';

    var core = require('web.core');
    const config = require('web.config');
    var CalendarModel = require("web.CalendarModel");
    var CalendarView = require("web.CalendarView");
    var TimeOffCalendarController = require("hr_holidays.dashboard.view_controller");
    var TimeOffPopoverRenderer = require("hr_holidays.dashboard.view_popover_renderer");
    var TimeOffCalendarRenderer = require("hr_holidays.dashboard.view_calendar_renderer");
    var viewRegistry = require('web.view_registry');

    var TimeOffCalendarView = CalendarView.extend({
        config: _.extend({}, CalendarView.prototype.config, {
            Controller: TimeOffCalendarController,
            Renderer: TimeOffCalendarRenderer,
            Model: CalendarModel,
        }),
    });

    /**
     * Calendar shown in the "Everyone" menu
     */
    var TimeOffCalendarAllView = CalendarView.extend({
        config: _.extend({}, CalendarView.prototype.config, {
            Controller: TimeOffCalendarController,
            Renderer: TimeOffPopoverRenderer,
        }),
    });

    viewRegistry.add('time_off_calendar', TimeOffCalendarView);
    viewRegistry.add('time_off_calendar_all', TimeOffCalendarAllView);
});
