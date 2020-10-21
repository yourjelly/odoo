import * as QUnit from "qunit";
import { WebClient } from "../../src/components/webclient/webclient";
import { Registry } from "../../src/core/registry";
import { makeFakeUserService, nextTick, OdooEnv } from "../helpers/index";
import { makeTestEnv, mount, TestConfig } from "../helpers/utility";
import { notificationService } from "../../src/services/notifications";
import { menusService } from "../../src/services/menus";
import { actionManagerService } from "../../src/services/action_manager/action_manager";
import { Component, tags } from "@odoo/owl";

let baseConfig: TestConfig;

class ClientAction extends Component<{}, OdooEnv> {
  static template = tags.xml`<div class="test_client_action">ClientAction</div>`;
}

QUnit.module("web client integrated tests", {
  async beforeEach() {
    const actionsRegistry = new Registry<any>();
    actionsRegistry.add("clientAction", ClientAction);
    const menus = {
      root: { id: "root", children: [1], name: "root", appID: "root" },
      1: { id: 1, children: [], name: "App0", appID: 1 },
    };
    const serverSideActions: any = {
      "wowl.client_action": {
        tag: "clientAction",
        target: "main",
        type: "ir.actions.client",
      },
    };
    const serverData = {
      menus,
      actions: serverSideActions,
    };
    const services = new Registry<any>();
    services.add("user", makeFakeUserService());
    services.add(notificationService.name, notificationService);
    services.add("menus", menusService);
    services.add("action_manager", actionManagerService);

    baseConfig = { serverData, actions: actionsRegistry, services };
  },
});

// was "can execute client actions from tag name"
QUnit.test("can display client actions from tag name", async function (assert) {
  assert.expect(3);
  const env = await makeTestEnv({
    ...baseConfig,
    mockRPC(...args) {
      assert.step(args[0]);
    },
  });
  const webClient = await mount(WebClient, { env });
  assert.verifySteps(["/wowl/load_menus"]);
  env.services.action_manager.doAction("clientAction");
  await nextTick();
  assert.containsOnce(
    // LPE fixme: should be inside  ".o_action_manager"
    webClient.el!,
    ".test_client_action"
  );
});

QUnit.test("can display client actions in Dialog", async function (assert) {
  assert.expect(1);

  const env = await makeTestEnv(baseConfig);
  const webClient = await mount(WebClient, { env });
  env.services.action_manager.doAction({
    target: "new",
    tag: "clientAction",
    type: "ir.actions.client",
  });
  await nextTick();
  assert.containsOnce(webClient.el!, ".modal .test_client_action");
});

QUnit.test("can display client actions as main, then in Dialog", async function (assert) {
  assert.expect(3);

  const env = await makeTestEnv(baseConfig);
  const webClient = await mount(WebClient, { env });

  env.services.action_manager.doAction("clientAction");
  await nextTick();
  assert.containsOnce(
    // LPE fixme: should be inside  ".o_action_manager"
    webClient.el!,
    ".test_client_action"
  );
  env.services.action_manager.doAction({
    target: "new",
    tag: "clientAction",
    type: "ir.actions.client",
  });
  await nextTick();
  assert.containsN(
    // LPE fixme: should be inside  ".o_action_manager"
    webClient.el!,
    ".test_client_action",
    2
  );
  assert.containsOnce(webClient.el!, ".modal .test_client_action");
});

QUnit.test("can display client actions in Dialog, then as main destroys Dialog", async function (
  assert
) {
  assert.expect(4);

  const env = await makeTestEnv(baseConfig);
  const webClient = await mount(WebClient, { env });
  env.services.action_manager.doAction({
    target: "new",
    tag: "clientAction",
    type: "ir.actions.client",
  });
  await nextTick();
  assert.containsOnce(webClient.el!, ".test_client_action");
  assert.containsOnce(webClient.el!, ".modal .test_client_action");
  env.services.action_manager.doAction("clientAction");
  await nextTick();
  assert.containsOnce(webClient.el!, ".test_client_action");
  assert.containsNone(webClient.el!, ".modal .test_client_action");
});
