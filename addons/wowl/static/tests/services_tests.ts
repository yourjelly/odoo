import * as QUnit from "qunit";
import { deployServices, Service } from "../src/services";
import { Registry } from "../src/registry";
import { OdooEnv } from "../src/env";

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
  deployServices(env, registry);
  assert.strictEqual(env.services.test, 17);
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

  deployServices(env, registry);
  assert.verifySteps(["appa", "aang"]);
});

QUnit.test("throw an error if missing dependency", async (assert) => {
  registry.add("aang", {
    dependencies: ["appa"],
    name: "aang",
    deploy() {
      assert.step("aang");
    },
  });

  assert.throws(() => deployServices(env, registry));
});
