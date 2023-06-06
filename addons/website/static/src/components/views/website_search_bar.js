/** @odoo-module **/

import { SearchBarMenu } from "@web/search/search_bar_menu/search_bar_menu";
import { SearchBar } from "@web/search/search_bar/search_bar";

export class WebsiteSearchBarMenu extends SearchBarMenu {
};
WebsiteSearchBarMenu.template = "website.SearchBarMenu";
WebsiteSearchBarMenu.props = {
    ...SearchBarMenu.props,
    websiteSelection: {optional: true, type: Object},
    activeWebsite: {optional: true, type: Object},
    onWebsiteSelected: {optional: true, type: Function},
};


export class WebsiteSearchBar extends SearchBar {};
WebsiteSearchBar.template = "website.SearchBar";
WebsiteSearchBar.components = { ...SearchBar.components, WebsiteSearchBarMenu };
WebsiteSearchBar.props = {
    ...SearchBar.props,
    websiteSelection: {optional: true, type: Object},
    activeWebsite: {optional: true, type: Object},
    onWebsiteSelected: {optional: true, type: Function},
};
