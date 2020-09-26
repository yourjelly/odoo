import type { Component } from "@odoo/owl";

type RPC = () => Promise<void>;

export const rpcService = {
  name: "rpc",
  start(): RPC {
    return async function (this: Component) {
      console.log("this is an rpc coming from ", this);
    };
  },
};
