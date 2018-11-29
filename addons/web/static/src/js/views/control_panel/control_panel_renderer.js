odoo.define('web.ControlPanelRenderer', function (require) {
"use strict";

var config = require('web.config');
var data = require('web.data');
var FilterMenu = require('web.FilterMenu');
var FavoriteMenu = require('web.FavoriteMenu');
var GroupByMenu = require('web.GroupByMenu');
var TimeRangeMenu = require('web.TimeRangeMenu');
var mvc = require('web.mvc');
var SearchBar = require('web.SearchBar');
var viewUtils = require('web.viewUtils');

var Renderer = mvc.Renderer;

var ControlPanelRenderer = Renderer.extend({
    template: 'ControlPanel',
    custom_events: {
        get_action_info: '_onGetActionInfo',
    },
    events: _.extend({}, Renderer.prototype.events, {
        'click.bs.dropdown .o_search_options .dropdown-menu': '_onDropdownClicked',
        'click .o_searchview_more': '_onMore',
    }),

    /**
     * @override
     * @param {Object[]} [params.controls=[]] list of nodes to render in the
     *   buttons area.
     * @param {Object[]} [params.breadcrumbs=[]] list of breadcrumbs elements
     * @param {boolean} [params.withBreadcrumbs=false] if false, breadcrumbs
     *   won't be rendered
     * @param {boolean} [params.withSearchBar=false] if false, no search bar
     *   is rendered
     * @param {string[]} params.searchMenuTypes
     * @param {String} [params.template] the QWeb template to render the
     *   ControlPanel. By default, the template 'ControlPanel' will be used.
     */
    init: function (parent, state, params) {
        this._super.apply(this, arguments);
        this.controls = params.controls || [];
        this._breadcrumbs = params.breadcrumbs || [];
        this.withBreadcrumbs = params.withBreadcrumbs;
        this.withSearchBar = params.withSearchBar;
        if (params.template) {
            this.template = params.template;
        }
        this.context = params.context;

        // TODO
        this.$subMenus = null;
        this.actionInfo = params.actionInfo;
        this.displaySearchMenu = true;
        this.menusSetup = false;
        this.searchMenuTypes = params.searchMenuTypes;
        this.subMenus = {};
    },
    /**
     * Renders the control panel and creates a dictionnary of its exposed
     * elements
     *
     * @override
     */
    start: function () {
        var self = this;

        // exposed jQuery nodesets
        this.nodes = {
            $buttons: this.$('.o_cp_buttons'),
            $pager: this.$('.o_cp_pager'),
            $sidebar: this.$('.o_cp_sidebar'),
            $switch_buttons: this.$('.o_cp_switch_buttons'),
        };

        // if we don't use the default search bar and buttons, we expose the
        // corresponding area for custom content
        if (!this.withSearchBar) {
            this.nodes.$searchview = this.$('.o_cp_searchview');
        }
        if (this.searchMenuTypes.length === 0) {
            this.nodes.$searchview_buttons = this.$('.o_search_options');
        }

        this.$controls = $('<div>', {class: 'o_cp_custom_buttons'});
        var hasCustomButtons = false;
        this.controls.forEach(function (node) {
            if (node.tag === 'button') {
                hasCustomButtons = true;
                self.$controls.append(self._renderButton(node));
            }
        });
        if (!hasCustomButtons) {
            this.$controls = $(); // fixme: this is to prevent the controlpanel
                                  // bottom row to take 5px height due to padding
        }

        this.render({});

        return $.when(this._super.apply(this, arguments), this._renderSearch()).then(function () {
            self._setSearchMenusVisibility();
        });
    },
    /**
     * @override
     */
    on_attach_callback: function () {
        this._focusSearchInput();
    },

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {Object}
     */
    getLastFacet: function () {
        return this.state.facets.slice(-1)[0];
    },
    /**
     * @param {Object} [status.active_view] the current active view
     * @param {Array} [status.breadcrumbs] the breadcrumbs to display (see _render_breadcrumbs() for
     * precise description)
     * @param {Object} [status.cp_content] dictionnary containing the new ControlPanel jQuery elements
     * @param {Boolean} [options.clear] set to true to clear from control panel
     * elements that are not in status.cp_content
     */
    render: function (status, options) {
        this._toggleVisibility(!status.hidden);

        options = _.defaults({}, options, {
            clear: true, // clear control panel by default
        });
        var new_cp_content = status.cp_content || {};

        // Detach special controls
        this.$controls.detach();

        // Render the breadcrumbs
        if (this.withBreadcrumbs) {
            this._renderBreadcrumbs(status.title);
        }
        // Detach control_panel old content and attach new elements
        var toDetach = this.nodes;
        if (options.clear) {
            this._detachContent(toDetach);
        } else {
            this._detachContent(_.pick(toDetach, _.keys(new_cp_content)));
        }
        this._attachContent(new_cp_content);
        if (status.active_view_selector) {
            this._updateSwitchButtons(status.active_view_selector);
        }

        // Attach special controls
        this.$controls.prependTo(this.nodes.$buttons);
    },
    updateState: function (state) {
        this.state = state;
        return this._renderSearch();
    },

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * @private
     * @param {Object} content dictionnary of jQuery elements to attach, whose
     *   keys are jQuery nodes identifiers in this.nodes
     */
    _attachContent: function (content) {
        for (var $element in content) {
            var $nodeset = content[$element];
            if ($nodeset && this.nodes[$element]) {
                this.nodes[$element].append($nodeset);
            }
        }
    },
    /**
     * @private
     * @param {Object} content subset of this.nodes to detach
     */
    _detachContent: function (content) {
        for (var $element in content) {
            content[$element].contents().detach();
        }
    },
    _getMenuItems: function (menuType) {
        var menuItems;
        if (menuType === 'filter') {
            menuItems = this.state.filters;
        }
        if (menuType === 'groupBy') {
            menuItems = this.state.groupBys;
        }
        if (menuType === 'timeRange') {
            menuItems = this.state.timeRanges;
        }
        if (menuType === 'favorite') {
            menuItems = this.state.favorites;
        }
        return menuItems;
    },
    _getSubMenusPlace: function () {
        return $('<div>').appendTo(this.$('.o_search_options'));
    },
    /**
     * @private
     */
    _focusSearchInput: function () {
        if (this.withSearchBar && !config.device.isMobile) {
            // in mobile mode, we would rathor not focusing manually the
            // input, because it opens up the integrated keyboard, which is
            // not what you expect when you just selected a filter.
            this.searchBar.input.$el.focus();
        }
    },
    /**
     * @private
     * @param {string} title
     */
    _renderBreadcrumbs: function (title) {
        var self = this;
        var breadcrumbsDescriptors = this._breadcrumbs.concat({
            title: title,
        });
        var breadcrumbs = breadcrumbsDescriptors.map(function (bc, index) {
            return self._renderBreadcrumbsItem(bc, index, breadcrumbsDescriptors.length);
        });
        this.$('.breadcrumb').html(breadcrumbs);
    },
    /**
     * Renders a breadcrumbs' li Jquery element
     *
     * @private
     */
    _renderBreadcrumbsItem: function (bc, index, length) {
        var self = this;
        var is_last = (index === length-1);
        var li_content = bc.title && _.escape(bc.title.trim()) || data.noDisplayContent;
        var $bc = $('<li>', {class: 'breadcrumb-item'})
            .append(is_last ? li_content : $('<a>', {href: '#'}).html(li_content))
            .toggleClass('active', is_last);
        if (!is_last) {
            $bc.click(function (ev) {
                ev.preventDefault();
                self.trigger_up('breadcrumb_clicked', {controllerID: bc.controllerID});
            });
        }
        return $bc;
    },
    /**
     * Renders a button to display in the buttons area, given an arch's node.
     *
     * @private
     * @param {Object} node
     */
    _renderButton: function (node) {
        var self = this;
        var $button = viewUtils.renderButtonFromNode(node);
        $button.on('click', function () {
            self.trigger_up('button_clicked', {
                attrs: node.attrs,
            });
        });
        return $button;
    },
    _renderSearch: function () {
        var defs = [];
        if (this.menusSetup) {
            this._updateMenus();
        } else {
            this.menusSetup = true;
            defs = defs.concat(this._setupMenus());
        }
        if (this.withSearchBar) {
            defs.push(this._renderSearchBar());
        }
        return $.when(this, defs).then(this._focusSearchInput.bind(this));
    },
    _renderSearchBar: function () {
        // TODO: might need a reload instead of a destroy/instantiate
        var oldSearchBar = this.searchBar;
        this.searchBar = new SearchBar(this, {
            context: this.context,
            facets: this.state.facets,
            fields: this.state.fields,
            filters: this.state.filters,
            filterFields: this.state.filterFields,
            groupBys: this.state.groupBys,
        });
        return this.searchBar.appendTo(this.$('.o_searchview')).then(function () {
            if (oldSearchBar) {
                oldSearchBar.destroy();
            }
        });
    },
    _setupMenu: function (menuType) {
        var Menu;
        if (menuType === 'filter') {
            Menu = FilterMenu;
        }
        if (menuType === 'groupBy') {
            Menu = GroupByMenu;
        }
        if (menuType === 'timeRange') {
            Menu = TimeRangeMenu;
        }
        if (menuType === 'favorite') {
            Menu = FavoriteMenu;
        }
        var menu = new Menu(this, this._getMenuItems(menuType), this.state.fields);
        this.subMenus[menuType] = menu;
        return menu.appendTo(this.$subMenus);
    },
    _setupMenus: function () {
        this.$subMenus = this._getSubMenusPlace();
        return this.searchMenuTypes.map(this._setupMenu.bind(this));
    },
    _setSearchMenusVisibility: function () {
        this.$('.o_searchview_more')
            .toggleClass('fa-search-plus', !this.displaySearchMenu)
            .toggleClass('fa-search-minus', this.displaySearchMenu);
        this.$('.o_search_options')
            .toggleClass('o_hidden', !this.displaySearchMenu);
    },
    /**
     * Toggles the visibility of the ControlPanel and detaches or attaches its
     * contents to clean the DOM
     *
     * @private
     * @param {boolean} visible true to show the control panel, false to hide it
     */
    _toggleVisibility: function (visible) {
        this.do_toggle(visible);
        if (!visible && !this.$content) {
            this.$content = this.$el.contents().detach();
        } else if (this.$content) {
            this.$content.appendTo(this.$el);
            this.$content = null;
        }
    },
    _updateMenus: function () {
        var self = this;
        this.searchMenuTypes.forEach(function (menuType) {
            self.subMenus[menuType].update(self._getMenuItems(menuType));
        });
    },
    /**
     * Removes active class on all switch-buttons and adds it to the one of the
     * active view
     *
     * @private
     * @param {string} selector the selector of the div to activate
     */
    _updateSwitchButtons: function (selector) {
        this.nodes.$switch_buttons.find('button').removeClass('active');
        this.$(selector).addClass('active');
    },

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    _onButtonClicked: function () {
        this.trigger_up('button_clicked', {});
    },
    /**
     * Prevents the search dropdowns from closing when clicking inside them.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onDropdownClicked: function (ev) {
        ev.stopPropagation();
    },
    _onGetActionInfo: function (ev) {
        ev.stopPropagation();
        ev.data.callback(this.actionInfo);
    },
    _onMore: function () {
        this.displaySearchMenu = !this.displaySearchMenu;
        this._setSearchMenusVisibility();
    },
});

return ControlPanelRenderer;

});
