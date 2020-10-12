import { Component } from "@odoo/owl";
import { Model, ModelBuilder } from "../../src/services/model";
import { Action } from "../../src/services/action_manager/helpers";
import { ModelData, ModelMethods, Service } from "../../src/types";
import { OdooEnv, makeFakeRPCService } from "./index";
import { Registry } from "../../src/core/registry";
import { MockedRoutes } from "./mocks";

// Aims:
// - Mock service model high level
// - propose mock model.call lower level
// - propose mock RPC low level

// Can be passed data
// returns at least model service

interface ServerData {
  models: {
    [modelName: string]: ModelData;
  };
  actions: {
    [key: string]: Action;
  };
  views: {
    [key: string]: string;
  };
}

/**
 * EXTENSION POINT: methods defined will be called with the data of the model as "this"
 */
export const standardModelMethodsRegistry: ModelMethods = {
  load_views: loadViews,
};
/*
 * BASIC MODEL METHODS
 */
function loadViews(this: ModelData) {
  console.log("loadViews", this);
}

// TODO: implement all methods of Model and remove Partial
export function makeFakeModelService(
  serverData?: ServerData,
  mockCallModel?: ModelMethods
): Service<Partial<ModelBuilder>> {
  const localData: ServerData = serverData || ({} as ServerData);
  function callModel(model: string) {
    return async (method: string, args = [], kwargs = {}) => {
      let res;
      const modelMethod =
        serverData &&
        serverData.models &&
        serverData.models[model] &&
        serverData.models[model].methods &&
        serverData.models[model].methods![method];
      if (modelMethod) {
        res = modelMethod.call(localData, args, kwargs);
      }
      if (mockCallModel && method in mockCallModel) {
        res = mockCallModel[method].call(localData, args, kwargs);
      }
      if (res === undefined && method in standardModelMethodsRegistry) {
        res = standardModelMethodsRegistry[method].call(localData, args, kwargs);
      }
      return res;
    };
  }
  return {
    name: "model",
    deploy(env: OdooEnv) {
      return function (this: Component | null, model: string): Partial<Model> {
        return {
          get call() {
            return callModel(model);
          },
        };
      };
    },
  };
}

export function makeMockServer(
  servicesRegistry: Registry<Service>,
  serverData?: ServerData,
  mockCallModel?: ModelMethods,
  mockedRoutes?: MockedRoutes
): Registry<Service> {
  const routes: MockedRoutes = {
    "/web/action/load": ({ action_id }: any) => {
      return (serverData && serverData.actions && serverData.actions[action_id]) || {};
    },
  };
  const rpcService = makeFakeRPCService(Object.assign(routes, mockedRoutes));
  const modelService = makeFakeModelService(serverData, mockCallModel);
  servicesRegistry.add("model", modelService).add("rpc", rpcService);
  return servicesRegistry;
}
