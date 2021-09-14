odoo.define('hr_holidays.dashboard.view_calendar_renderer', function(require) {

    var core = require('web.core');
    const config = require('web.config');
    var TimeOffPopoverRenderer = require('hr_holidays.dashboard.view_popover_renderer');

    var QWeb = core.qweb;

    var TimeOffCalendarRenderer = TimeOffPopoverRenderer.extend({
        _render: function () {
            var self = this;
            return this._super.apply(this, arguments).then(function () {
                return self._rpc({
                    model: 'hr.leave.type',
                    method: 'get_days_all_request',
                    context: self.context,
                });
            }).then(function (result) {
                self.$el.parent().find('.o_calendar_mini').hide();
                self.$el.parent().find('.o_timeoff_container').remove();

                // Do not display header if there is no element to display
                if (result.length > 0) {
                    if (config.device.isMobile) {
                        result.forEach((data) => {
                            const elem = QWeb.render('hr_holidays.dashboard_calendar_header_mobile', {
                                timeoff: data,
                            });
                            self.$el.find('.o_calendar_filter_item[data-value=' + data[4] + '] .o_cw_filter_title').append(elem);
                        });
                    } else {
                        const elem = QWeb.render('hr_holidays.dashboard_calendar_header', {
                            timeoffs: result,
                        });
                        self.$el.before(elem);
                    }
                }
            });
        },
    });
    return TimeOffCalendarRenderer;
});
