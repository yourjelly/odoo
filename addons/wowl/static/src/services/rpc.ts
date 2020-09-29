import type { Component } from "@odoo/owl";
import type { OdooEnv } from "../env";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface RPCRouteQuery {
  route: string;
  params?: { [key: string]: any };
}

interface RPCModelQuery {
  model: string;
  method: string;
  args?: any[];
  kwargs?: { [key: string]: any };
}

export type RPCQuery = RPCRouteQuery | RPCModelQuery;

type RPC = (query: RPCQuery) => Promise<any>;

interface RPCError {
  type: "server";
  message: string;
  code: number;
  data_message: string;
  data_debug: string;
}

// -----------------------------------------------------------------------------
// Main RPC method
// -----------------------------------------------------------------------------

function computeParams(query: RPCQuery, env: OdooEnv): { [key: string]: any } {
  const userContext = env.services["user"].context;

  let params: any;
  if ("route" in query) {
    // call a controller
    params = query.params || {};
    params.context = userContext;
  } else {
    // call a model
    params = { model: query.model, method: query.method };
    let context = userContext;
    params.args = query.args || [];
    params.kwargs = { context };
    if (query.kwargs) {
      Object.assign(params.kwargs, query.kwargs);
    }
    if (query.kwargs && query.kwargs.context) {
      params.kwargs.context = Object.assign({}, userContext, query.kwargs.context);
    }
  }
  return params;
}

function jsonrpc(query: RPCQuery, env: OdooEnv): Promise<any> {
  const bus = env.bus;
  const XHR = env.browser.XMLHttpRequest;

  const data = {
    id: Math.floor(Math.random() * 1000 * 1000 * 1000),
    jsonrpc: "2.0",
    method: "call",
    params: computeParams(query, env),
  };

  let url: string;
  if ("route" in query) {
    url = query.route;
  } else {
    url = `/web/dataset/call_kw/${query.model}/${query.method}`;
  }
  return new Promise((resolve, reject) => {
    const request = new XHR();

    // handle success
    request.addEventListener("load", (data) => {
      const response = JSON.parse(request.response);
      if ("error" in response) {
        // Odoo returns error like this, in a error field instead of properly
        // using http error codes...
        const error: RPCError = {
          type: "server",
          message: response.error.message,
          code: response.error.code,
          data_debug: response.error.data.debug,
          data_message: response.error.data.message,
        };
        bus.trigger("RPC_ERROR", error);
        reject(error);
      }
      resolve(response.result);
    });

    // handle failure
    request.addEventListener("error", () => {
      reject();
      bus.trigger("RPC_ERROR");
    });

    // configure and send request
    request.open("POST", url);
    request.setRequestHeader("Content-Type", "application/json");
    request.send(JSON.stringify(data));
  });
}

// -----------------------------------------------------------------------------
// RPC service
// -----------------------------------------------------------------------------
export const rpcService = {
  dependencies: ["user"],
  name: "rpc",
  deploy(env: OdooEnv): RPC {
    return function (this: Component | null, query: RPCQuery): Promise<any> {
      return jsonrpc(query, env);
    };
  },
};
