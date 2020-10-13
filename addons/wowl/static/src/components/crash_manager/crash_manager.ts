import { Component, hooks } from "@odoo/owl";
import { OdooEnv, Type } from "../../types";
import { RPCError, RPCServerError } from "../../services/rpc";
import { ErrorDialog } from "../error_dialogs/error_dialogs";
const { useState, useExternalListener } = hooks;

type ScriptError = {
  type: "script";
  message: string;
  stack: string;
};

type HandledError = ScriptError | RPCServerError;

interface Crash {
  id: number;
  dialogClass: Type<Component>;
  error: HandledError;
}

interface Crashes {
  [key: number]: Crash;
}

export class CrashManager extends Component<{}, OdooEnv> {
  static template = "wowl.CrashManager";
  crashes = useState({} as Crashes);
  crashId: number = 1;

  constructor() {
    super(...arguments);
    useExternalListener(window, "error", this.onError);
  }

  mounted() {
    this.env.bus.on("RPC_ERROR", this, this.onRPCError);
  }

  willUnmount() {
    this.env.bus.off("RPC_ERROR", this);
  }

  addDialog(dialogClass: Type<Component>, error: HandledError) {
    const id = this.crashId++;
    this.crashes[id] = {
      id,
      dialogClass,
      error,
    };
  }

  onDialogClosed(id: number) {
    delete this.crashes[id];
  }

  onError(ev: ErrorEvent) {
    const { colno, error, filename, lineno, message } = ev;
    if (!filename && !lineno && !colno) {
      this.addDialog(ErrorDialog, {
        type: "script",
        message: "Unknown CORS error",
        stack:
          "An unknown CORS error occured. The error probably originates from a JavaScript file served from a different origin. (Opening your browser console might give you a hint on the error.)",
      });
    } else {
      // ignore Chrome video internal error: https://crbug.com/809574
      if (!error && message === "ResizeObserver loop limit exceeded") {
        return;
      }
      const traceback = error ? error.stack : "";
      this.addDialog(ErrorDialog, {
        type: "script",
        message,
        stack: `${filename}:${lineno}\n${this.env._t("Traceback:")}\n${traceback}`,
      });
    }
  }

  onRPCError(error: RPCError) {
    if (error.type !== "server") {
      return;
    }
    let dialogClass;
    if (error.name && this.env.registries.errorDialogs.contains(error.name)) {
      dialogClass = this.env.registries.errorDialogs.get(error.name);
    }
    this.addDialog(dialogClass || ErrorDialog, error);
  }
}
