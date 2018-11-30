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
        this._title = params.title || '';
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
        // corresponding areas for custom content
        if (!this.withSearchBar) {
            this.nodes.$searchview = this.$('.o_cp_searchview');
        }
        if (this.searchMenuTypes.length === 0) {
            this.nodes.$searchview_buttons = this.$('.o_search_options');
        }

        // render and append custom controls
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
        this.$controls.prependTo(this.nodes.$buttons);

        if (this.withBreadcrumbs) {
            this._renderBreadcrumbs(this._title);
        }

        var superDef = this._super.apply(this, arguments);
        var searchDef = this._renderSearch();
        return $.when(superDef, searchDef).then(function () {
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
     * This function is called when actions call 'updateControlPanel' with
     * custom contents to insert in the exposed areas.
     *
     * @param {Object} [status.cp_content] dictionnary containing the jQuery
     *   elements to insert in the exposed areas
     * @param {string} [status.title] the title of the current controller, to
     *   display at the end of the breadcrumbs
     * @param {Boolean} [options.clear=true] set to false to keep control panel
     *   elements that are not in status.cp_content (useful for partial updates)
     */
    updateContents: function (status, options) {
        var new_cp_content = status.cp_content || {};
        var clear = 'clear' in options ? options.clear : true;

        if (this.withBreadcrumbs) {
            this._renderBreadcrumbs(status.title);
        }

        // detach custom controls so that they can be re-appended afterwards
        this.$controls.detach();
        var toDetach = this.nodes;
        if (clear) {
            this._detachContent(toDetach);
        } else {
            this._detachContent(_.pick(toDetach, _.keys(new_cp_content)));
        }
        this._attachContent(new_cp_content);
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
    _updateMenus: function () {
        var self = this;
        this.searchMenuTypes.forEach(function (menuType) {
            self.subMenus[menuType].update(self._getMenuItems(menuType));
        });
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
