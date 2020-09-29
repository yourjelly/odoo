import { Component, tags } from "@odoo/owl";
import * as QUnit from "qunit";
import { Registry } from "../../src/core/registry";
import { Service, useService } from "../../src/services";
import { rpcService, RPCQuery } from "../../src/services/rpc";
import {
  getFixture,
  makeFakeUserService,
  makeTestEnv,
  mount,
  Deferred,
  makeDeferred,
} from "../helpers";

const { xml } = tags;
// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function createMockXHR(
  response?: any,
  sendCb?: (data: any) => void,
  def?: Deferred<any>
): typeof XMLHttpRequest {
  let MockXHR: typeof XMLHttpRequest = function () {
    return {
      _loadListener: null,
      url: "",
      addEventListener(type: string, listener: any) {
        if (type === "load") {
          this._loadListener = listener;
        }
      },
      open(method: string, url: string) {
        this.url = url;
      },
      setRequestHeader() {},
      async send(data: string) {
        if (sendCb) {
          sendCb.call(this, JSON.parse(data));
        }
        if (def) {
          await def;
        }
        (this._loadListener as any)();
      },
      response: JSON.stringify(response || ""),
    };
  } as any;
  return MockXHR;
}

interface RPCInfo {
  url: string;
  request: any;
}

async function testRPC(query: RPCQuery): Promise<RPCInfo> {
  let url: string = "";
  let request: any;
  let MockXHR = createMockXHR({ test: true }, function (this: any, data) {
    request = data;
    url = this.url;
  });
  const env = await makeTestEnv({
    services: serviceRegistry,
    browser: { XMLHttpRequest: MockXHR },
  });
  await env.services.rpc(query);
  return { url, request };
}

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------
let serviceRegistry: Registry<Service<any>>;

QUnit.module("RPC", {
  beforeEach() {
    serviceRegistry = new Registry();
    serviceRegistry.add("user", makeFakeUserService());
    serviceRegistry.add("rpc", rpcService);
  },
});

QUnit.test("can perform a simple rpc", async (assert) => {
  assert.expect(4);
  let MockXHR = createMockXHR({ result: { action_id: 123 } }, (request) => {
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

QUnit.test("add user context to every (route) request", async (assert) => {
  assert.expect(2);
  let MockXHR = createMockXHR({ result: { some: "request" } }, (data) => {
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

QUnit.test("rpc with simple routes", async (assert) => {
  const info1 = await testRPC({ route: "/my/route" });
  assert.strictEqual(info1.url, "/my/route");

  const info2 = await testRPC({ route: "/my/route", params: { hey: "there", model: "test" } });
  assert.deepEqual(info2.request.params, {
    context: {
      allowed_company_ids: [1],
      lang: "en_us",
      tz: "Europe/Brussels",
      uid: 2,
    },
    hey: "there",
    model: "test",
  });
});

QUnit.test("basic rpc with context", async (assert) => {
  const info = await testRPC({ model: "partner", method: "test", kwargs: { context: { a: 1 } } });
  assert.deepEqual(info.request.params.kwargs.context, {
    allowed_company_ids: [1],
    lang: "en_us",
    tz: "Europe/Brussels",
    uid: 2,
    a: 1,
  });
});

QUnit.test("basic rpc (method of model)", async (assert) => {
  const info = await testRPC({ model: "partner", method: "test", kwargs: { context: { a: 1 } } });
  assert.strictEqual(info.url, "/web/dataset/call_kw/partner/test");
  assert.strictEqual(info.request.params.model, "partner");
  assert.strictEqual(info.request.params.method, "test");
});

QUnit.test("rpc with args and kwargs", async (assert) => {
  const info = await testRPC({
    model: "partner",
    method: "test",
    args: ["arg1", 2],
    kwargs: { k: 78 },
  });
  assert.strictEqual(info.url, "/web/dataset/call_kw/partner/test");
  assert.strictEqual(info.request.params.args[0], "arg1");
  assert.strictEqual(info.request.params.args[1], 2);
  assert.strictEqual(info.request.params.kwargs.k, 78);
});

QUnit.test("rpc coming from destroyed components are left pending", async (assert) => {
  class MyComponent extends Component {
    static template = xml`<div/>`;
    rpc = useService("rpc");
  }
  const def = makeDeferred();
  let MockXHR = createMockXHR({ result: "1" }, () => {}, def);

  const env = await makeTestEnv({
    services: serviceRegistry,
    browser: { XMLHttpRequest: MockXHR },
  });

  const component = await mount(MyComponent, { env, target: getFixture() });
  let isResolved = false;
  let isFailed = false;
  component
    .rpc({ route: "/my/route" })
    .then(() => {
      isResolved = true;
    })
    .catch(() => {
      isFailed = true;
    });
  assert.strictEqual(isResolved, false);
  assert.strictEqual(isFailed, false);

  component.destroy();
  def.resolve();
  await Promise.resolve();
  await Promise.resolve();

  assert.strictEqual(isResolved, false);
  assert.strictEqual(isFailed, false);
});
