import { Component, hooks } from "@odoo/owl";
import { Callback } from "@odoo/owl/dist/types/core/event_bus";
import { useSetupAction, useSetupActionParams } from "../../action_manager/action_manager";
import { Domain } from "../../core/domain";
import { useService } from "../../core/hooks";
import { ViewDescriptions } from "../../services/view_manager";
import { OdooEnv, ViewProps } from "../../types";
import { ControllerQueryParams, SearchMenuType, SearchModel } from "./search_model";

const { onWillStart, onMounted } = hooks;

interface useSearchParams {
  onSaveParams?: () => ControllerQueryParams;
  onSearchReady?: Callback;
  onSearchUpdate?: Callback;
  searchMenuTypes?: SearchMenuType[];
}

export function useSearch(params: useSearchParams) {
  const component = Component.current!;
  const props = component.props as ViewProps;

  const userService = useService("user");
  const modelService = useService("model");
  const localizationService = useService("localization");
  const searchMenuTypes = params.searchMenuTypes;

  const searchModel = new SearchModel({
    env: component.env as OdooEnv,
    _localizationService: localizationService,
    _modelService: modelService,
    _userService: userService,
    searchMenuTypes,
    onSaveParams: params.onSaveParams,
  });

  onWillStart(async () => {
    const viewDescriptions = await _useLoadViews(props);

    await searchModel.load({
      context: props.context,
      domain: new Domain(props.domain),
      modelName: props.model,
      searchViewDescription: viewDescriptions.search,
    });

    if (params.onSearchReady) {
      await params.onSearchReady.call(component);
    }
  });

  if (params.onSearchUpdate) {
    searchModel.on("update", null, params.onSearchUpdate.bind(component));
  }

  return searchModel;
}

type useSetupViewParams = useSearchParams & useSetupActionParams;

export interface ViewData {
  search: SearchModel;
  modelName: string;
  load: () => Promise<void>;
}

function _useLoadViews(props: ViewProps): Promise<ViewDescriptions> {
  const vm = useService("view_manager");
  const params = {
    model: props.model,
    views: props.views,
    context: props.context,
  };
  const options = {
    actionId: props.actionId,
    context: props.context,
    withActionMenus: props.withActionMenus,
    withFilters: props.withFilters,
  };
  return vm.loadViews(params, options);
}

export function useSetupView(setup: useSetupViewParams): ViewData {
  const component = Component.current!;
  const props: ViewProps = component.props;
  const title = useService("title");

  useSetupAction({
    export: setup.export,
    beforeLeave: setup.beforeLeave,
  });

  let resolve: any;
  let isReady: Promise<void> = new Promise((_resolve) => {
    resolve = _resolve;
  });

  const onSearchReady = async () => {
    if (setup.onSearchReady) {
      await setup.onSearchReady();
    }
    resolve();
  };

  const search = useSearch({
    searchMenuTypes: setup.searchMenuTypes,
    onSearchReady,
    onSearchUpdate: setup.onSearchUpdate,
    onSaveParams: setup.onSaveParams,
  });

  const data: ViewData = {
    search,
    load: () => isReady,
    modelName: props.model,
  };

  // should probably do this only in main mode, not in a dialog or something...
  onMounted(() => {
    title.setParts({ action: props.action.name });
  });

  return data;
}
