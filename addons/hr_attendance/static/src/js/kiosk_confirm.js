odoo.define('hr_attendance.kiosk_confirm', function (require) {
"use strict";

var AbstractAction = require('web.AbstractAction');
var core = require('web.core');
var field_utils = require('web.field_utils');
var QWeb = core.qweb;

var KioskConfirm = AbstractAction.extend({
    events: {
        "click .o_hr_attendance_back_button": function () { this.do_action(this.next_action, {clear_breadcrumbs: true}); },
        "click .o_hr_attendance_sign_in_out_icon": _.debounce(function () {
            var self = this;
            this._rpc({
                    model: 'hr.employee',
                    method: 'attendance_manual',
                    args: [[this.employee_id], this.next_action],
                })
                .then(function(result) {
                    if (result.action) {
                        self.do_action(result.action);
                    } else if (result.warning) {
                        self.do_warn(result.warning);
                    }
                });
        }, 200, true),
        'click .o_hr_attendance_pin_pad_button_0': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 0; },
        'click .o_hr_attendance_pin_pad_button_1': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 1; },
        'click .o_hr_attendance_pin_pad_button_2': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 2; },
        'click .o_hr_attendance_pin_pad_button_3': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 3; },
        'click .o_hr_attendance_pin_pad_button_4': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 4; },
        'click .o_hr_attendance_pin_pad_button_5': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 5; },
        'click .o_hr_attendance_pin_pad_button_6': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 6; },
        'click .o_hr_attendance_pin_pad_button_7': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 7; },
        'click .o_hr_attendance_pin_pad_button_8': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 8; },
        'click .o_hr_attendance_pin_pad_button_9': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = this.el.querySelector('.o_hr_attendance_PINbox').value + 9; },
        'click .o_hr_attendance_pin_pad_button_C': function() { this.el.querySelector('.o_hr_attendance_PINbox').value = ''; },

        'click .o_hr_attendance_pin_pad_button_ok': _.debounce(function() {
            var self = this;
            this.el.querySelector('.o_hr_attendance_pin_pad_button_ok').attributes.disabled = "disabled";
            this._rpc({
                    model: 'hr.employee',
                    method: 'attendance_manual',
                    args: [[this.employee_id], this.next_action, this.el.querySelector('.o_hr_attendance_PINbox').value],
                })
                .then(function(result) {
                    if (result.action) {
                        self.do_action(result.action);
                    } else if (result.warning) {
                        self.do_warn(result.warning);
                        self.el.querySelector('.o_hr_attendance_PINbox').value = '';
                        setTimeout( function() { self.el.querySelector('.o_hr_attendance_pin_pad_button_ok').removeAttribute("disabled"); }, 500);
                    }
                });
        }, 200, true),
    },

    init: function (parent, action) {
        this._super.apply(this, arguments);
        this.next_action = 'hr_attendance.hr_attendance_action_kiosk_mode';
        this.employee_id = action.employee_id;
        this.employee_name = action.employee_name;
        this.employee_state = action.employee_state;
        this.employee_hours_today = field_utils.format.float_time(action.employee_hours_today);
    },

    start: function () {
        var self = this;
        this.getSession().user_has_group('hr_attendance.group_hr_attendance_use_pin').then(function(has_group){
            self.use_pin = has_group;
            self.el.innerHTML = QWeb.render("HrAttendanceKioskConfirm", {widget: self});
            self.start_clock();
        });
        return self._super.apply(this, arguments);
    },

    start_clock: function () {
        this.el.querySelector('.o_hr_attendance_clock').innerText = new Date().toLocaleTimeString(navigator.language, {hour: '2-digit', minute:'2-digit', second:'2-digit'}); 500;
        // First clock refresh before interval to avoid delay
        this.el.querySelector('.o_hr_attendance_clock').innerText = new Date().toLocaleTimeString(navigator.language, {hour: '2-digit', minute:'2-digit', second:'2-digit'});
    },

    destroy: function () {
        clearInterval(this.clock_start);
        this._super.apply(this, arguments);
    },
});

core.action_registry.add('hr_attendance_kiosk_confirm', KioskConfirm);

return KioskConfirm;

});