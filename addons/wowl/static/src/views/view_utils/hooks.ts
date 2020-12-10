import { Component, hooks } from "@odoo/owl";
import { useService } from "../../core/hooks";
import { ViewDescriptions } from "../../services/view_manager";
import { ViewProps } from "../../types";

const { onWillStart, onMounted } = hooks;

interface SearchParams {
  onSearchReady?: any;
  onSearchUpdate?: any;
}

export function useSearch(params: SearchParams) {
  const component = Component.current!;
  const props = component.props;

  onWillStart(async () => {
    const viewDescriptions = await _useLoadViews(props);
    // process here search description...
    viewDescriptions.search;
    if (params.onSearchReady) {
      await params.onSearchReady.call(component);
    }
  });

  let domain: any[] = [];
  let groupBy: any[] = [];

  return {
    get domain(): any[] {
      return domain;
    },
    get groupBy(): any[] {
      return groupBy;
    },
  };
}

interface ViewSetupParams extends SearchParams {
  // onViewReady?: any;
}

export interface ViewData {
  arch: string | null;
  viewId: number | null;
  fields: { [key: string]: any } | null;
  search: any;
  modelName: string;
  isReady: Promise<void>;
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

export function useSetupView(setup: ViewSetupParams): ViewData {
  const component = Component.current!;
  const props: ViewProps = component.props;
  const title = useService("title");

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

  const search = useSearch({ onSearchReady, onSearchUpdate: setup.onSearchUpdate });

  const data: ViewData = {
    arch: null,
    viewId: null,
    fields: null,
    search,
    isReady,
    modelName: props.model,
  };

  // should probably do this only in main mode, not in a dialog or something...
  onMounted(() => {
    title.setParts({"action": props.action.name})
  });
  onWillStart(async () => {
    const viewDescriptions = await _useLoadViews(props);
    const descr = viewDescriptions[props.type];
    data.arch = descr.arch;
    data.viewId = descr.view_id;
    data.fields = descr.fields;
  });

  return data;
}
