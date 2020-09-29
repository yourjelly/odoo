import * as QUnit from "qunit";
import { Registry } from "../../src/core/registry";
import { Service } from "../../src/services";
import { rpcService } from "../../src/services/rpc";
import { makeFakeUserService, makeTestEnv } from "../helpers";

let serviceRegistry: Registry<Service<any>>;

QUnit.module("RPC", {
  beforeEach() {
    serviceRegistry = new Registry();
    serviceRegistry.add("user", makeFakeUserService());
    serviceRegistry.add("rpc", rpcService);
  },
});

function createMockXHR(response: any, sendCb?: (data: any) => void): typeof XMLHttpRequest {
  let mockXHR = {
    _loadListener: null,
    addEventListener(type: string, listener: any) {
      if (type === "load") {
        this._loadListener = listener;
      }
    },
    open() {},
    setRequestHeader() {},
    send(data: string) {
      if (sendCb) {
        sendCb(JSON.parse(data));
      }
      (this._loadListener as any)();
    },
    response: JSON.stringify(response),
  };
  let MockXHR: typeof XMLHttpRequest = function () {
    return mockXHR;
  } as any;
  return MockXHR;
}

QUnit.test("can perform a simple rpc", async (assert) => {
  assert.expect(4);
  let MockXHR = createMockXHR({ action_id: 123 }, (request) => {
    assert.strictEqual(request.jsonrpc, "2.0");
    assert.strictEqual(request.method, "call");
    assert.ok(typeof request.id === "number");
  });

  const env = await makeTestEnv({
    services: serviceRegistry,
    browser: { XMLHttpRequest: MockXHR },
  });
  const result = await env.services.rpc({ route: "/test/" });
  assert.deepEqual(result, { action_id: 123 });
});

QUnit.test("trigger an error on bus when response has 'error' key", async (assert) => {
  assert.expect(2);
  const error = {
    message: "message",
    code: 12,
    data: {
      debug: "data_debug",
      message: "data_message",
    },
  };
  let MockXHR = createMockXHR({ error });

  const env = await makeTestEnv({
    services: serviceRegistry,
    browser: { XMLHttpRequest: MockXHR },
  });

  env.bus.on("RPC_ERROR", null, (payload) => {
    assert.deepEqual(payload, {
      code: 12,
      data_debug: "data_debug",
      data_message: "data_message",
      message: "message",
      type: "server",
    });
  });
  try {
    await env.services.rpc({ route: "/test/" });
  } catch (e) {
    assert.ok(true);
  }
});

QUnit.test("add user context to every request", async (assert) => {
  assert.expect(2);
  let MockXHR = createMockXHR({ some: "request" }, (data) => {
    assert.deepEqual(data.params.context, {
      allowed_company_ids: [1],
      lang: "en_us",
      tz: "Europe/Brussels",
      uid: 2,
    });
  });

  const env = await makeTestEnv({
    services: serviceRegistry,
    browser: { XMLHttpRequest: MockXHR },
  });

  const result = await env.services.rpc({ route: "/test/" });
  assert.deepEqual(result, { some: "request" });
});
