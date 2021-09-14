odoo.define('hr_holidays.employee.dashboard.views', function(require) {
    'use strict';

    var core = require('web.core');
    const config = require('web.config');
    var CalendarView = require("web.CalendarView");
    var TimeOffCalendarRenderer = require("hr_holidays.dashboard.view_calendar_renderer");
    var TimeOffCalendarEmployeeController = require("hr_holidays.employee.dashboard.view_controller");
    var viewRegistry = require('web.view_registry');

    var TimeOffCalendarEmployeeView = CalendarView.extend({
        config: _.extend({}, CalendarView.prototype.config, {
            Controller: TimeOffCalendarEmployeeController,
            Renderer: TimeOffCalendarRenderer,
        }),
    });

    viewRegistry.add('time_off_employee_calendar', TimeOffCalendarEmployeeView);
});
