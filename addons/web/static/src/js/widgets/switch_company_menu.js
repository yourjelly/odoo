odoo.define('web.SwitchCompanyMenu', function(require) {
    "use strict";

    var Model = require('web.Model');
    var session = require('web.session');
    var Widget = require('web.Widget');

    var SwitchCompanyMenu = Widget.extend({
        template: 'SwitchCompanyMenu',
        init: function(parent) {
            this._super(parent);
        },
        start: function() {
            var self = this;

            this.$el.on('click', '.dropdown-menu li a[data-menu]', function(ev) {
                ev.preventDefault();
                var f = self['on_menu_' + $(this).data('menu')];
                if(f) {
                    f($(this));
                }
            });

            new Model("res.users").call("read_companies").then(function(res) {
                if(res) {
                    self.$('.oe_topbar_name').text(res.current_company[1]);

                    self.do_show();
                    var companies_list = '';
                    _.each(res.all_allowed_companies, function(company) {
                        var a = '';
                        if(company[0] == res.current_company[0]) {
                            a = '<i class="fa fa-check" style="margin-right:10px;"></i>';
                        } else {
                            a = '<span style="margin-right:23px;"/>';
                        }
                        companies_list += '<li><a href="#" data-menu="company" data-company-id="' + company[0] + '">' + a + company[1] + '</a></li>';
                    });
                    self.$('.dropdown-menu').html(companies_list);
                } else {
                    self.do_hide();
                }
            });
        },
        on_menu_company: function(selected) {
            var company_id = selected.data('company-id');
            new Model('res.users').call('write', [[session.uid], {'company_id': company_id}]).then(function() {
                location.reload();
            });
        },
    });

    return SwitchCompanyMenu;
});
