import type { Component } from "@odoo/owl";
import { EventBus } from "@odoo/owl/dist/types/core/event_bus";
import type { OdooEnv } from "../env";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------
interface RPCRouteQuery {
  route: string;
}

interface RPCModelQuery {
  model: string;
  method: string;
}

type RPCQuery = RPCRouteQuery | RPCModelQuery;

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
function jsonrpc(XHR: typeof XMLHttpRequest, query: RPCQuery, bus: EventBus): Promise<any> {
  const data = {
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 1000 * 1000 * 1000),
  };

  const url = "route" in query ? query.route : "nope";
  return new Promise((resolve, reject) => {
    const request = new XHR();

    // handle success
    request.addEventListener("load", (data) => {
      const result = JSON.parse(request.response);
      if ("error" in result) {
        // Odoo returns error like this, in a error field instead of properly
        // using http error codes...
        const error: RPCError = {
          type: "server",
          message: result.error.message,
          code: result.error.code,
          data_debug: result.error.data.debug,
          data_message: result.error.data.message,
        };
        bus.trigger("RPC_ERROR", error);
        reject(error);
      }
      console.log(result, request.response);
      resolve(result);
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
    const bus = env.bus;
    const XHR = env.browser.XMLHttpRequest;
    return function (this: Component | null, query: RPCQuery): Promise<any> {
      return jsonrpc(XHR, query, bus);
    };
  },
};
