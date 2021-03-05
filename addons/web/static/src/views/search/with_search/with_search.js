/** @odoo-module **/

import { SearchModel } from "../search_model";
import { useModel } from "../../view_utils/model";

const { Component, hooks } = owl;
const { useSubEnv } = hooks;

const SEARCH_KEYS = ["context", "domain", "domains", "groupBy", "orderBy"];

export class WithSearch extends Component {
  setup() {
    this.Component = this.props.Component;

    this.searchKeys = SEARCH_KEYS;
    if (this.Component.props) {
      this.searchKeys = this.searchKeys.filter((key) => key in this.Component.props);
    }

    this.searchModel = useModel({
      Model: this.Component.SearchModel || this.constructor.SearchModel,
    });

    useSubEnv({
      searchModel: this.searchModel,
    });
  }

  async willStart() {
    const config = Object.assign({}, this.props, {
      searchKeys: this.searchKeys,
    });
    await this.searchModel.load(config);
  }

  async willUpdateProps(nextProps) {
    const config = {};
    for (const key of SEARCH_KEYS) {
      if (nextProps[key]) {
        config[key] = nextProps[key];
      }
    }
    await this.searchModel.load(config);
  }

  get componentProps() {
    const { searchQuery } = this.searchModel;
    return Object.assign({}, this.props.componentProps, searchQuery);
  }

  get withSearchPanel() {
    const { sections } = this.searchModel;
    return sections.size > 0;
  }
}

WithSearch.defaultProps = {
  componentProps: {},
};
WithSearch.props = {
  Component: Function,
  componentProps: Object,

  modelName: String,

  actionId: { type: [Number,false], optional: 1 },
  displayName: { type: String, optional: 1 },

  // search query elements
  context: { type: Object, optional: 1 },
  domain: { type: Array, element: [String, Array], optional: 1 },
  domains: { type: Array, element: Object, optional: 1 },
  groupBy: { type: Array, element: String, optional: 1 },
  orderBy: { type: Array, element: String, optional: 1 },

  // search view description
  arch: { type: String, optional: 1 },
  fields: { type: Object, optional: 1 },
  irFilters: { type: Array, element: Object, optional: 1 },
  viewId: { type: [Number, false], optional: 1 },

  // extra options
  activateDefaultFavorite: { type: Boolean, optional: 1 },
  dynamicFilters: { type: Array, element: Object, optional: 1 },
  loadFavorites: { type: Boolean, optional: 1 },
  loadSearchPanel: { type: Boolean, optional: 1 },
  loadSearchView: { type: Boolean, optional: 1 },
  searchMenuTypes: { type: Array, element: String, optional: 1 },
};
WithSearch.template = "web.WithSearch";

WithSearch.SearchModel = SearchModel;
