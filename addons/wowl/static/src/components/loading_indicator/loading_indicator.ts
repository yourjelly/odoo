import { Component, useState } from "@odoo/owl";
import type { OdooEnv } from "../../types";

export class LoadingIndicator extends Component<{}, OdooEnv> {
  static template = "wowl.LoadingIndicator";
  state = useState({
    count: 0,
    isShown: false,
  });
  rpcIds = new Set();
  blockUITimer?: number;

  constructor() {
    super(...arguments);
    this.env.bus.on("RPC:REQUEST", this, this.requestCall);
    this.env.bus.on("RPC:RESPONSE", this, this.responseCall);
  }

  requestCall(rpcId: number) {
    if (this.state.count === 0) {
      this.state.isShown = true;
      this.blockUITimer = this.env.browser.setTimeout(this.env.services.ui.block, 3000);
    }
    this.rpcIds.add(rpcId);
    this.state.count++;
  }

  responseCall(rpcId: number) {
    this.rpcIds.delete(rpcId);
    this.state.count = this.rpcIds.size;
    if (this.state.count === 0) {
      clearTimeout(this.blockUITimer);
      this.env.services.ui.unblock();
      this.state.isShown = false;
    }
  }
}
