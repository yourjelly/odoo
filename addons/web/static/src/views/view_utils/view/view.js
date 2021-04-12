/** @odoo-module **/

import { viewRegistry } from "../../view_registry";
import { useService } from "../../../services/service_hook";
import { WithSearch } from "../../search/with_search/with_search";
import { evaluateExpr } from "../../../py_js/py";

const { Component, QWeb } = owl;

export class View extends Component {
  setup() {
    if (!("type" in this.props || "jsClass" in this.props)) {
      throw Error(`View props should have a "type" key or a "jsClass" key`);
    }
    if (!("modelName" in this.props)) {
      throw Error(`View props should have a "modelName" key`);
    }

    this._viewService = useService("view");

    this.withSearchProps = null;
  }

  async willStart() {
    // determine view type
    let ViewClass;
    let { jsClass, type } = this.props;
    jsClass = undefined;

    if (jsClass) {
      ViewClass = viewRegistry.get(jsClass);
      type = ViewClass.type;
    }

    // determine views for which descriptions should be obtained
    let { views, viewId, searchViewId } = this.props;
    views = JSON.parse(JSON.stringify(views));
    const view = views.find((v) => v[1] === type);
    if (view) {
      view[0] = viewId || view[0];
      viewId = view[0];
    } else {
      views.push([viewId || false, type]);
    }
    const searchView = views.find((v) => v[1] === "search");
    if (searchView) {
      searchView[0] = searchViewId || searchView[0];
      searchViewId = searchView[0];
    } else if (searchViewId) {
      views.push([searchViewId, "search"]);
    }

    // prepare view description
    const { actionId, context, modelName, loadActionMenus, loadFavorites } = this.props;
    let viewDescription = { modelName, type };
    let searchViewDescription;
    let { arch, fields, searchViewArch, searchViewFields, irFilters, actionMenus } = this.props;

    if (
      !arch ||
      !fields ||
      (!actionMenus && loadActionMenus) ||
      (!searchViewArch && searchViewId) ||
      (!searchViewFields && searchViewId) ||
      (!irFilters && loadFavorites && searchViewId)
    ) {
      // view description (or search view description if required) is incomplete
      // a loadViews is done to complete the missing information
      const viewDescriptions = await this._viewService.loadViews(
        { context, model: modelName, views },
        { actionId, withActionMenus: loadActionMenus, withFilters: loadFavorites }
      );
      // Note: if this.props.views is different from views, the cached descriptions
      // will certainly not been reused! (but for the standard flow this will work as
      // before)
      viewDescription = viewDescriptions[type];
      searchViewDescription = viewDescriptions.search;
    }

    if (arch) {
      viewDescription.arch = arch;
    }
    if (fields) {
      viewDescription.fields = fields;
    }
    if (actionMenus) {
      // good name for prop?
      viewDescription.actionMenus = actionMenus;
    }

    // prepare search view description if a search view id has been given
    if (searchViewId) {
      // maybe other info even if searchViewId has not been received?
      if (!searchViewDescription) {
        searchViewDescription = { viewId: searchViewId };
      }
      if (searchViewArch) {
        searchViewDescription.arch = searchViewArch;
      }
      if (searchViewFields) {
        searchViewDescription.fields = searchViewFields;
      }
      if (irFilters) {
        searchViewDescription.irFilters = irFilters;
      }
    }

    const parser = new DOMParser();
    const xml = parser.parseFromString(viewDescription.arch, "text/xml");
    const rootNode = xml.documentElement;
    const rootAttrs = {};
    for (const attrName of rootNode.getAttributeNames()) {
      rootAttrs[attrName] = rootNode.getAttribute(attrName);
    }

    //////////////////////////////////////////////////////////////////
    /** @todo take care of sample and banner rootAttribute and props*/
    //////////////////////////////////////////////////////////////////

    // determine ViewClass to instantiate (if not already done)
    if (!jsClass) {
      if (rootAttrs.js_class) {
        // jsClass = rootAttrs.js_class
      }
    }
    if (jsClass && !ViewClass) {
      ViewClass = viewRegistry.get(jsClass);
    } else {
      ViewClass = viewRegistry.get(type);
    }

    // prepare the view props
    let viewProps = {};
    for (const key in this.props) {
      // search query elements are processed by WithSearch component
      if (!["context", "domain", "domains", "groupBy", "orderBy", "views", "noContentHelp"].includes(key)) {
        viewProps[key] = this.props[key];
      }
    }

    viewProps.views = views;

    let { noContentHelp } = this.props;
    if (noContentHelp) {
      const htmlHelp = document.createElement("div");
      htmlHelp.innerHTML = noContentHelp;
      if (htmlHelp.innerText.trim()) {
        viewProps.noContentHelp = noContentHelp;
      }
    }

    if (!("useSampleModel" in this.props)) {
      viewProps.useSampleModel = Boolean(evaluateExpr(rootAttrs.sample || "0"));
    }

    viewProps.viewId = viewDescription.viewId;
    viewProps.arch = viewDescription.arch;
    viewProps.fields = viewDescription.fields;
    if (viewDescription.actionMenus) {
      viewProps.actionMenus = viewDescription.actionMenus;
    }

    if (searchViewDescription) {
      viewProps.searchViewId = searchViewDescription.viewId;
      viewProps.searchViewArch = searchViewDescription.arch;
      viewProps.searchViewFields = searchViewDescription.fields;
      if (searchViewDescription.irFilters) {
        viewProps.irFilters = searchViewDescription.irFilters;
      }

      // determine loadSearchPanel here and display
      // const DEFAULT_VIEW_TYPES = ["kanban", "list"];
      // if (node.hasAttribute("view_types")) {
      //   data.viewTypes.push(...node.getAttribute("view_types").split(","));
      // } else {
      //   data.viewTypes.push(...DEFAULT_VIEW_TYPES);
      // }

    }

    if (ViewClass.props) {
      for (const key in viewProps) {
        if (!(key in ViewClass.props)) {
          delete viewProps[key];
        }
      }
    }

    // prepare the WithSearh component props
    this.withSearchProps = {};
    for (const key in this.props) {
      if (!["viewId", "arch", "fields"].includes(key)) {
        this.withSearchProps[key] = this.props[key];
      }
    }

    Object.assign(
      this.withSearchProps,
      searchViewDescription,
      { Component: ViewClass, componentProps: viewProps },
    );

    
    if (!this.withSearchProps.searchMenuTypes) {
      this.withSearchProps.searchMenuTypes =
      ViewClass.searchMenuTypes || this.constructor.searchMenuTypes;
    }
    
    //////////////////////////////////////////////////////////////////
    /** @todo prepare loadSearchPanel WithSearch prop (depends on view
     * types on searchpanel tag in search arch)                     */
    //////////////////////////////////////////////////////////////////
    
    for (const key in this.withSearchProps) {
      if (!(key in WithSearch.props)) {
        delete this.withSearchProps[key];
      }
    }
  }

  async willUpdateProps(nextProps) {
    // we assume that nextProps can only vary in the search keys:
    // context, domain, domains, groupBy, orderBy
    const { context, domain, domains, groupBy, orderBy } = nextProps;
    Object.assign(this.withSearchProps, { context, domain, domains, groupBy, orderBy });
  }
}

View.template = "web.View";
View.components = { WithSearch };
View.defaultProps = {
  actionId: false,
  display: {},
  context: {},
  loadActionMenus: false,
  loadFavorites: false,
  views: [],
};

View.searchMenuTypes = ["filter", "groupBy", "favorite"];

QWeb.registerComponent("View", View);

/**
 * VIEW API:
 *
 * Mandatory:
 *  - modelName: String
 *  - type: String or jsClass: String
 *
 * Optional:
 *
 *  View description
 *  - viewId: Number || false
 *  - arch: String
 *  - fields: Object
 *  - actionMenus: Object
 *
 *  SearchView description
 *  - searchViewId: Number || false
 *  - searchViewArch: String
 *  - searchViewFields: Object
 *  - irFilters: IrFilter[]
 * 
 *  Search query
 *  - context: Object,
 *  - domain: DomainRepr
 *  - domains: ... to rework
 *  - groupBy: String[]
 *  - orderBy: String[]
 *
 *  Others manipulated by View or WithSearch
 *  - actionId: [Number,false]
 *  - activateDefaultFavorite: Boolean,
 *  - banner: String,
 *  - display: Object,
 *  - displayName: String
 *  - dynamicFilters: Object[]
 *  - loadActionMenus: Boolean,
 *  - loadFavorites: Boolean,
 *  - loadSearchPanel: Boolean, --> check what is best for View and WithSearch APIs (related to view_types,...)
 *  - noContentHelp: String,
 *  - searchMenuTypes: String[]
 *  - views: Array[],
 *  - useSampleModel: Boolean
 *
 *  Other props are passed (like others (sometimes a bit modified like "views")) to concrete view
 *  if it validate them (a filtering is done)
 * 
 *  + see view_api.txt

 // to check

  Relate to search
      searchModel // search model state (searchItems, query)
      searchPanel // search panel component state (expanded (hierarchy), scrollbar)

  Related to config/display/layout
      displayName // not exactly actionName,... action.display_name || action.name
      breadcrumbs
      withBreadcrumbs // 'no_breadcrumbs' in context ? !context.no_breadcrumbs : true,
      withControlPanel // this.withControlPanel from constructor
      withSearchBar // 'no_breadcrumbs' in context ? !context.no_breadcrumbs : true,
      withSearchPanel // this.withSearchPanel from constructor
      search_panel // = params.search_panel or context.search_panel

  Prepare for concrete view
      activeActions
      ...

  Do stuff in View comp
      banner // from arch = this.arch.attrs.banner_route
*/
