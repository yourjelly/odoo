import { Component, hooks } from "@odoo/owl";
import { useService } from "../../core/hooks";
import { ViewDescriptions } from "../../services/view_manager";
import { OdooEnv, ViewProps } from "../../types";
import { SearchModel, ModelParams } from "../view_utils/search_model";
import { FavoriteMenu } from "../view_utils/favorite_menu/favorite_menu";
import { FilterMenu } from "../view_utils/filter_menu/filter_menu";
import { Layout } from "../view_utils/layout/layout";
import { Dialog } from "../../components/dialog/dialog";
import { Dropdown } from "../../components/dropdown/dropdown";
import { DropdownItem } from "../../components/dropdown/dropdown_item";
// import { SubTemplates } from "../__toremove_or_adapt__/base_view";
import { Domain } from "../../core/domain";
const { useSubEnv } = hooks;

export interface SubTemplates {
  cpTopLeft: string | null;
  cpTopRight: string | null;
  cpBottomLeft: string | null;
  cpBottomRight: string | null;
  main: string | null;
}

export type FieldType =
  | "float"
  | "integer"
  | "boolean"
  | "char"
  | "one2many"
  | "many2many"
  | "many2one"
  | "number"
  | "date"
  | "datetime"
  | "selection";

export interface FieldDefinition {
  relation?: string;
  relation_field?: string;
  string: string;
  type: FieldType;
  default?: any;
  selection?: any[][];
  store?: boolean;
  sortable?: boolean;
}

export interface Fields {
  [fieldName: string]: FieldDefinition;
} // similar to ModelFields but without id

export interface ViewEnv extends OdooEnv {
  model: SearchModel;
}

export class View<
  T extends ViewProps = ViewProps,
  U extends SearchModel = SearchModel
> extends Component<T, OdooEnv> {
  static template = "wowl.AbstractView";
  static modelClass = SearchModel;
  static components = { FavoriteMenu, FilterMenu, Dialog, Dropdown, DropdownItem, Layout };

  model: U;
  modelParams: any = {} as ModelParams;

  viewManager = useService("view_manager");
  actionManager = useService("action_manager");

  cpSubTemplates: SubTemplates = {
    cpTopLeft: "wowl.Views.ControlPanelTopLeft",
    cpTopRight: null,
    cpBottomLeft: null,
    cpBottomRight: "wowl.Views.ControlPanelBottomRight",
    main: null,
  };

  constructor(parent?: Component | null, props?: T) {
    super(...arguments);

    const Model = (this.constructor as any).modelClass;
    const model = new Model(this.env);
    this.model = model;
    useSubEnv({ model });
  }

  async willStart() {
    const params = {
      model: this.props.model,
      views: this.props.views,
      context: this.props.context,
    };
    const options = {
      actionId: this.props.actionId,
      context: this.props.context,
      withActionMenus: this.props.withActionMenus,
      withFilters: this.props.withFilters,
    };
    const viewDescriptions = await this.viewManager.loadViews(params, options);

    this.processViewDescriptions(viewDescriptions);

    await this.model.load(this.modelParams);
  }

  mounted() {
    this.model.on("UPDATE", this, this.render);
  }

  willUnmount() {
    this.model.off("UPDATE", this); // useful?
  }

  /** we set here parts of own state and set model params */
  processViewDescriptions(viewDescriptions: ViewDescriptions) {
    const { context, domain, model: modelName } = this.props;
    Object.assign(this.modelParams, {
      context,
      domain: new Domain(domain), // should be done before
      modelName,
      searchViewDescription: viewDescriptions.search,
    });
  }
}
