import * as QUnit from "qunit";
import { uiService } from "../../src/services/ui/ui";
import { OdooEnv, Service } from "../../src/types";
import { Registry } from "../../src/core/registry";
import { getFixture, makeTestEnv, mount, nextTick } from "../helpers/index";
import { TestConfig } from "../helpers/utility";

let target: HTMLElement;
let services: Registry<Service>;
let browser: Partial<OdooEnv["browser"]>;
let baseConfig: TestConfig;

QUnit.module("UI", {
  async beforeEach() {
    target = getFixture();
    services = new Registry<Service>();
    services.add(uiService.name, uiService);
    browser = { setTimeout: () => 1 };
    baseConfig = { services, browser };
  },
});

QUnit.test("block and unblock once ui with ui service", async (assert) => {
  const env = await makeTestEnv({ ...baseConfig });
  const ui = env.services.ui;
  await mount(env.registries.Components.get("BlockUI"), { env, target });
  let blockUI = target.querySelector(".o_blockUI");
  assert.strictEqual(blockUI, null, "ui should not be blocked");

  ui.block();
  await nextTick();
  blockUI = target.querySelector(".o_blockUI");
  assert.notStrictEqual(blockUI, null, "ui should be blocked");

  ui.unblock();
  await nextTick();
  blockUI = target.querySelector(".o_blockUI");
  assert.strictEqual(blockUI, null, "ui should not be blocked");
});

QUnit.test("use block and unblock several times to block ui with ui service", async (assert) => {
  const env = await makeTestEnv({ ...baseConfig });
  const ui = env.services.ui;
  await mount(env.registries.Components.get("BlockUI"), { env, target });
  let blockUI = target.querySelector(".o_blockUI");
  assert.strictEqual(blockUI, null, "ui should not be blocked");

  ui.block();
  ui.block();
  ui.block();
  await nextTick();
  blockUI = target.querySelector(".o_blockUI");
  assert.notStrictEqual(blockUI, null, "ui should be blocked");

  ui.unblock();
  ui.unblock();
  await nextTick();
  blockUI = target.querySelector(".o_blockUI");
  assert.notStrictEqual(blockUI, null, "ui should be blocked");

  ui.unblock();
  await nextTick();
  blockUI = target.querySelector(".o_blockUI");
  assert.strictEqual(blockUI, null, "ui should not be blocked");
});
