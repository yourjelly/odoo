odoo.define('hr_holidays.dashboard.view_custo', function(require) {
    'use strict';

    var core = require('web.core');
    var CalendarPopover = require('web.CalendarPopover');
    var CalendarController = require("web.CalendarController");
    var CalendarRenderer = require("web.CalendarRenderer");
    var CalendarView = require("web.CalendarView");
    const utils = require("web.utils");
    var viewRegistry = require('web.view_registry');

    var _t = core._t;
    var QWeb = core.qweb;

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

    var TimeOffCalendarController = CalendarController.extend({
        events: _.extend({}, CalendarController.prototype.events, {
            'click .btn-time-off': '_onNewTimeOff',
            'click .btn-allocation': '_onNewAllocation',
        }),

        //--------------------------------------------------------------------------
        // Public
        //--------------------------------------------------------------------------

         /**
         * Render the buttons and add new button about
         * times off and allocations request
         *
         * @override
         */

        renderButtons: function ($node) {
            this._super.apply(this, arguments);

            $(QWeb.render('hr_holidays.dashboard.calendar.button', {
                time_off: _t('New Time Off Request'),
                request: _t('New Allocation Request'),
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

            this.do_action('hr_holidays.hr_leave_action_my_request', {
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
    });

    class TimeOffPopoverRenderer extends CalendarRenderer {
        _getPopoverParams(eventData) {
            let params = super._getPopoverParams(...arguments);
            let calendarIcon;
            let state = eventData.extendedProps.record.state;

            if (state === 'validate') {
                calendarIcon = 'fa-calendar-check-o';
            } else if (state === 'refuse') {
                calendarIcon = 'fa-calendar-times-o';
            } else if(state) {
                calendarIcon = 'fa-calendar-o';
            }

            return Object.assign(params, {
                title: eventData.extendedProps.record.display_name.split(':').slice(0, -1).join(':'),
                template: this.env.qweb.renderToString('hr_holidays.calendar.popover.placeholder', {
                    color: this.getColor(eventData.color_index),
                    calendarIcon: calendarIcon,
                }),
            });
        }
    }
    TimeOffPopoverRenderer.components = Object.assign({},
        CalendarRenderer.components,
        {
            CalendarPopover: TimeOffCalendarPopover,
        },
    );

    class TimeOffCalendarRenderer extends TimeOffPopoverRenderer {
        async willStart() {
            await super.willStart(...arguments);
            await this.loadHeader();
        }
        async willUpdateProps() {
            await super.willUpdateProps(...arguments);
            await this.loadHeader();
        }
        async loadHeader() {
            this.timeoffs = await this.env.services.rpc({
                model: 'hr.leave.type',
                method: 'get_days_all_request',
                context: this.env.context,
            });
        }
        _render() {
            super._render();
            const container = this.el.parentElement.querySelector('.o_timeoff_container');
            if (container) {
                container.remove();
            }
            const elem = utils.stringToElement(
                this.env.qweb.renderToString('hr_holidays.dashboard_calendar_header', {
                    timeoffs: this.timeoffs,
                })
            );
            this.el.parentElement.insertBefore(elem, this.el);
        }
    }

    var TimeOffCalendarView = CalendarView.extend({
        config: _.extend({}, CalendarView.prototype.config, {
            Controller: TimeOffCalendarController,
            Renderer: TimeOffCalendarRenderer,
        }),
    });

    /**
     * Calendar shown in the "Everyone" menu
     */
    var TimeOffCalendarAllView = CalendarView.extend({
        config: _.extend({}, CalendarView.prototype.config, {
            Renderer: TimeOffPopoverRenderer,
        }),
    });

    viewRegistry.add('time_off_calendar', TimeOffCalendarView);
    viewRegistry.add('time_off_calendar_all', TimeOffCalendarAllView);
});
