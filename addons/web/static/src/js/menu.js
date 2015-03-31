odoo.define('web.Menu', function (require) {
"use strict";

var core = require('web.core');
var session = require('web.session');
var Widget = require('web.Widget');
var pyeval = require('web.pyeval');
var SystrayMenu = require('web.SystrayMenu');
var UserMenu = require('web.UserMenu');
var CompanyLogo = require('web.CompanyLogo');

var QWeb = core.qweb;

var Menu = Widget.extend({
    template: 'Menu',
    init: function () {
        this._super.apply(this, arguments);
        this.is_bound = $.Deferred();
        this.$menu_sections = {};
    },
    willStart: function () {
        var self = this;
        return session.rpc('/web/dataset/call', {
            model: 'ir.ui.menu',
            method: 'load_menus',
            args: [pyeval.eval('context', session.user_context)],  // FIXME: is it the real slim sha.. hum context?
        }).then(function(menu_data) {
            self.menu_data = menu_data;
        });
    },
    start: function () {
        var self = this;

        // Bus events
        core.bus.on('do_reload_needaction', this, this.fetch_needactions);

        // App switcher
        this.$app_switcher = $(QWeb.render('AppSwitcher', {'menu_data': this.menu_data}));
        this.$app_switcher.appendTo(this.$el.siblings('.o-application-switcher'));
        this.$app_switcher.on('click', '.thumbnail', this, function (ev) {
            ev.preventDefault();
            var menu_id = $(ev.currentTarget).data('menu');
            var action_id = $(ev.currentTarget).data('action-id');
            var needaction = $(ev.target).is('#menu_counter');
            self._on_primary_menu_click(menu_id, action_id, needaction);
        });
        this.$('.o-menu-toggle').click(function (ev) {
            ev.preventDefault();
            self.toggle_app_switcher();
        });

        // Navbar (menu sections)
        var $menu_sections = $(QWeb.render('Menu.sections', {'menu_data': this.menu_data}));
        $menu_sections.siblings('section').each(function () {
            self.$menu_sections[Number(this.className)] = $(this).find('.dropdown');  // FIXME: gross implementation but the idea is ok imo
        });
        this.$menu_brand_placeholder = this.$('.o-menu-brand');
        this.$menu_brand_placeholder.click(function (ev) {
            ev.preventDefault();
            self.toggle_app_switcher();
        });
        this.$section_placeholder = this.$('.o-menu-sections');
        _.each(this.$menu_sections, function ($section, primary_menu_id) {
            $section.on('click', 'a[data-menu]', self, function (ev) {
                ev.preventDefault();
                var menu_id = $(ev.currentTarget).data('menu');
                var action_id = $(ev.currentTarget).data('action-id');
                var needaction = $(ev.currentTarget).is('#menu_counter');
                self._on_secondary_menu_click(menu_id, action_id, needaction);
            });
        });

        // FIXME: Systray Menu
        this.systray_menu = new SystrayMenu(this);
        this.systray_menu.setElement(this.$('.oe_systray'));
        this.systray_menu.start();

        // FIXME FIXME FIXME: Hack, see https://github.com/twbs/bootstrap/issues/12738
        _.each(this.$menu_sections, function ($section, primary_menu_id) {
            $section.find('.dropdown-menu').css({
                maxHeight: $(window).height() - $(".navbar-header").height() + "px",
                overflow: "auto",
            });
        });

        // UserMenu
        this.user_menu = new UserMenu(this);
        this.user_menu.appendTo(this.$app_switcher.find('.o-user-menu-placeholder'));
        this.user_menu.do_update();

        // Company Logo
        this.company_logo = new CompanyLogo(this);
        this.company_logo.appendTo(this.$app_switcher.find('.o-company-logo-placeholder'));


        this.is_bound.resolve();
        return this._super.apply(this, arguments);
    },
    toggle_app_switcher: function () {
        this.$el.siblings('.o-application-switcher').toggleClass('hidden');
    },
    /**
     * Helper to find the action associated to a menu id, handling the special case of the primary
     * menu where we have to find the action fo its first leaf.
     */
    _menu_id_to_action_id: function (menu_id) {
        // FIXME: only implemented to avoid querying the dom. Is it worth it?
        for (var i = 0; i <= this.menu_data.children.length; i++) {
            var child = this.menu_data.children[i];
            if (child.id === menu_id) {
                if (child.action) {
                    return child.action;
                } else {
                    while (child.children) {
                        child = child.children[0];
                        if (child.action) {
                            return child.action;
                        }
                    }
                }
            }
        }
    },
    _action_id_to_menu_id: function (action_id, root) {
        if (!root) {root = $.extend(true, {}, this.menu_data)}

        if (root.action && root.action.split(',')[1] == action_id) {
            return root.id;
        }
        for (var i = 0; i < root.children.length; i++) {
            var menu_id = this._action_id_to_menu_id(action_id, root.children[i]);
            if (menu_id !== undefined) {
                return menu_id;
            }
        }
        return undefined;
    },
    /**
     * Fetch the needactions counter associated to the secondary menu items of
     * a primary menu and render their badges.
     */
    fetch_needactions: function(primary_menu_id) {
        // FIXME: DOM queries
        var self = this;
        if (!primary_menu_id && this.current_primary_menu) {
            primary_menu_id = this.current_primary_menu;
        }
        // Needaction
        var secondary_menu_ids = this.$menu_sections[primary_menu_id].find('a[data-menu]').map(function (index, value) {
            return $(value).data('menu');
        }).get();
        if (secondary_menu_ids) {
            self.rpc('/web/menu/load_needaction', {
                'menu_ids': secondary_menu_ids,
            }).done(function(needactions) {
                _.each(needactions, function (item, menu_id) {
                    var $item = self.$menu_sections[primary_menu_id].find('a[data-menu="' + menu_id + '"]');
                    $item.find('.badge').remove();
                    if (item.needaction_counter && item.needaction_counter > 0) {
                        $item.append(QWeb.render("Menu.needaction_counter", { widget : item }));
                    }
                });
            });
        }
    },
    _show_section: function (primary_menu_id) {
        if (this.current_primary_menu) {
            this.$menu_sections[this.current_primary_menu].detach();
        }
        this.$menu_sections[primary_menu_id].appendTo(this.$section_placeholder);
    },
    decorate_action: function (action_id) {
        var menu_id = this._action_id_to_menu_id(action_id);
        this.decorate_secondary_menu(menu_id);
    },
    decorate_primary_menu: function(primary_menu_id) {
        this._show_section(primary_menu_id);
        var menu_text;
        for (var i = 0; i < this.menu_data.children.length; i++) {
            if (this.menu_data.children[i].id == primary_menu_id) {
                menu_text = this.menu_data.children[i].name;
            }
        };
        this.$menu_brand_placeholder.text(menu_text);
        this.fetch_needactions(primary_menu_id);
    },
    decorate_secondary_menu: function(secondary_menu_id) {
        var self = this;
        // Keep primary menu in sync
        if (!this.current_primary_menu) {
            _.each(this.$menu_sections, function ($section, primary_menu_id) {
                if ($section.find('a[data-menu=' + secondary_menu_id + ']').length) {
                    self.decorate_primary_menu(primary_menu_id);
                    self.current_primary_menu = primary_menu_id;
                }
            });
        }
    },
    _trigger_menu_click: function(menu_id, action_id, needaction) {
        core.bus.trigger('menu_click', {
            id: menu_id,
            action_id: action_id,
            needaction: needaction,
            previous_menu_id: this.current_secondary_menu || this.current_primary_menu,
        });
    },
    _on_primary_menu_click: function(menu_id, action_id, needaction) {
        var self = this;
        self.decorate_primary_menu(menu_id);
        action_id = action_id ? action_id : self._menu_id_to_action_id(menu_id).split(',')[1];

        if (action_id) {
            self._trigger_menu_click(menu_id, action_id, needaction);
            this.trigger('primary_menu_click', {id: menu_id});
            this.current_primary_menu = menu_id;
        }

        self.toggle_app_switcher();
    },
    _on_secondary_menu_click: function(menu_id, action_id, needaction) {
        var self = this;
        self.decorate_secondary_menu(menu_id);

        action_id = action_id ? action_id : self._menu_id_to_action_id(menu_id);

        // It is still possible that we don't have an action_id (for example, menu toggler)
        if (action_id) {
            self._trigger_menu_click(menu_id, action_id, needaction);
            this.trigger('secondary_menu_click', {id: menu_id});
            this.current_secondary_menu = menu_id;
        }
    },
    open_menu: function(menu_id) {
        // FIXME: still useful????
        if (this.$primary_menu.find('a[data-menu=' + menu_id + ']').length) {
            var $item = this.$secondary_menu.find("div[data-menu-parent=" + menu_id + "]").find('a:first');
            this._on_secondary_menu_click($item.data('menu'));
        } else {
            this._on_secondary_menu_click(menu_id);
        }
    },
    open_default_action: function () {
        var menu_data_tmp = $.extend(true, {}, this.menu_data);
        while (menu_data_tmp.children.length) {
            menu_data_tmp = menu_data_tmp.children[0];
        }
        var menu_id = menu_data_tmp.id;
        var action_id = menu_data_tmp.action ? menu_data_tmp.action.split(',')[1] : undefined;

        if (menu_id) {
            this._on_secondary_menu_click(menu_id, action_id);
        }
    },
});

return Menu;

});
