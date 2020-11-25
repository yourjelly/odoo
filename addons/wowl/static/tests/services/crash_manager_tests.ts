import * as QUnit from "qunit";
import { makeTestEnv, OdooEnv } from "../helpers/index";
import { Registry } from "../../src/core/registry";
import { Registries, Service, Type } from "../../src/types";
import { crashManagerService } from "../../src/crash_manager/crash_manager_service";
import { DialogManagerService } from "../../src/services/dialog_manager";
import { Component, tags } from "@odoo/owl";
import { RPCErrorDialog } from "../../src/crash_manager/error_dialogs";
import { RPCError } from "../../src/services/rpc";

function makeFakeDialogManagerService(
  open: (dialogClass: Type<Component>, props?: object) => void
): Service<DialogManagerService> {
  return {
    name: "dialog_manager",
    deploy(): DialogManagerService {
      return { open };
    },
  };
}

let env: OdooEnv;
let serviceRegistry: Registries["serviceRegistry"];

QUnit.module("CrashManager", {
  async beforeEach() {
    serviceRegistry = new Registry();
    serviceRegistry.add(crashManagerService.name, crashManagerService);
  },
});

QUnit.test("handle RPC_ERROR of type='server' and no associated dialog class", async (assert) => {
  assert.expect(2);

  const error = new RPCError();
  error.code = 701;
  error.message = "Some strange error occured";
  (error.data = {
    debug: "somewhere",
  }),
    (error.subType = "strange_error");

  function open(dialogClass: Type<Component>, props?: object) {
    assert.strictEqual(dialogClass, RPCErrorDialog);
    assert.deepEqual(props, {
      name: "RPC_ERROR",
      type: "server",
      code: 701,
      data: {
        debug: "somewhere",
      },
      subType: "strange_error",
      message: "Some strange error occured",
      exceptionName: undefined,
      traceback: error.stack,
    });
  }
  serviceRegistry.add("dialog_manager", makeFakeDialogManagerService(open));
  env = await makeTestEnv({ serviceRegistry });
  env.bus.trigger("ERROR_DISPATCH", error);
});

QUnit.test(
  "handle RPC_ERROR of type='server' and associated custom dialog class",
  async (assert) => {
    assert.expect(2);
    class CustomDialog extends Component<{}, OdooEnv> {
      static template = tags.xml`<RPCErrorDialog title="'Strange Error'"/>`;
      static components = { RPCErrorDialog };
    }

    const error = new RPCError();
    error.code = 701;
    error.message = "Some strange error occured";
    error.component = CustomDialog;

    function open(dialogClass: Type<Component>, props?: object) {
      assert.strictEqual(dialogClass, CustomDialog);
      assert.deepEqual(props, {
        name: "RPC_ERROR",
        type: "server",
        code: 701,
        data: undefined,
        subType: undefined,
        message: "Some strange error occured",
        exceptionName: undefined,
        traceback: error.stack,
      });
    }
    serviceRegistry.add("dialog_manager", makeFakeDialogManagerService(open));
    env = await makeTestEnv({ serviceRegistry });
    odoo.errorDialogRegistry.add("strange_error", CustomDialog);
    env.bus.trigger("ERROR_DISPATCH", error);
  }
);
