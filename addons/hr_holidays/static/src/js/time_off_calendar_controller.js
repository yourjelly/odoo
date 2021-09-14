odoo.define('hr_holidays.dashboard.view_controller', function(require) {
    'use strict';

    var core = require('web.core');

    var CalendarController = require("web.CalendarController");

    var _t = core._t;
    var QWeb = core.qweb;

    var TimeOffCalendarController = CalendarController.extend({
        events: _.extend({}, CalendarController.prototype.events, {
            'click .btn-time-off': '_onNewTimeOff',
            'click .btn-allocation': '_onNewAllocation',
        }),

        /**
         * @override
         */
        start: function () {
            this.$el.addClass('o_timeoff_calendar');
            return this._super(...arguments);
        },

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

         /**
         * Render the buttons and add new button about
         * time off and allocations request
         *
         * @override
         */

        renderButtons: function ($node) {
            this._super.apply(this, arguments);

            $(QWeb.render('hr_holidays.dashboard.calendar.button', {
                time_off: _t('New Time Off'),
                request: _t('Allocation Request'),
            })).appendTo(this.$buttons);

            if ($node) {
                this.$buttons.appendTo($node);
            } else {
                this.$('.o_calendar_buttons').replaceWith(this.$buttons);
            }
        },

        //--------------------------------------------------------------------------
        // Handlers
        //--------------------------------------------------------------------------

        /**
         * Action: create a new time off request
         *
         * @private
         */
        _onNewTimeOff: function () {
            var self = this;
            //use formViewId for this view?
            this.do_action('hr_holidays.hr_leave_action_my_request', {
                'additional_context': {
                    'default_request_date_from': moment().format('YYYY-MM-DD'),
                    'default_request_date_to': moment().add(1, 'days').format('YYYY-MM-DD'),
                },
                on_close: function () {
                    self.reload();
                }
            });
        },

        /**
         * Action: create a new allocation request
         *
         * @private
         */
        _onNewAllocation: function () {
            var self = this;
            this.do_action({
                type: 'ir.actions.act_window',
                res_model: 'hr.leave.allocation',
                name: 'New Allocation Request',
                views: [[false,'form']],
                context: {'form_view_ref': 'hr_holidays.hr_leave_allocation_view_form_dashboard'},
                target: 'new',
            }, {
                on_close: function () {
                    self.reload();
                }
            });
        },

        /**
         * @override
         */
        _setEventTitle: function () {
            return _t('Time Off Request');
        },
    });
    return TimeOffCalendarController;
});
