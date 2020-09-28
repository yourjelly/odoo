import * as QUnit from "qunit";
import { deployServices, Service } from "../../src/services";
import { Registry } from "../../src/core/registry";
import { OdooEnv } from "../../src/env";
import { makeDeferred } from "../helpers";

let registry: Registry<Service>;
let env: OdooEnv;

QUnit.module("deployServices", {
  beforeEach() {
    registry = new Registry();
    env = { services: {} } as any;
  },
});

QUnit.test("can deploy a service", async (assert) => {
  registry.add("test", {
    name: "test",
    deploy() {
      return 17;
    },
  });
  await deployServices(env, registry);
  assert.strictEqual(env.services.test, 17);
});

QUnit.test("can deploy an asynchronous service", async (assert) => {
  const def = makeDeferred();
  registry.add("test", {
    name: "test",
    deploy() {
      debugger;
      return def;
    },
  });
  deployServices(env, registry);
  assert.strictEqual(env.services.test, undefined);
  def.resolve(15);
  await Promise.resolve();
  assert.strictEqual(env.services.test, 15);
});

QUnit.test("can deploy a service with a dependency", async (assert) => {
  registry.add("aang", {
    dependencies: ["appa"],
    name: "aang",
    deploy() {
      assert.step("aang");
    },
  });
  registry.add("appa", {
    name: "appa",
    deploy() {
      assert.step("appa");
    },
  });

  await deployServices(env, registry);
  assert.verifySteps(["appa", "aang"]);
});

QUnit.test("throw an error if missing dependency", async (assert) => {
  assert.expect(1);
  registry.add("aang", {
    dependencies: ["appa"],
    name: "aang",
    deploy() {
      assert.step("aang");
    },
  });
  try {
    await deployServices(env, registry);
  } catch (e) {
    assert.ok(true);
  }
});
