# Writing Tests

We take very seriously code quality. Tests is an important part of a solid and
robust application. Each feature should be (if reasonable) tested properly, in
the QUnit test suite (available in the route `/wowl/tests`)

Tests are written in the `static/tests` folder. The main entry point for the
suite is `static/tests/main.ts`, which is the code that setup the test suite
environment. Also, some helpers are available in `static/tests/helpers.ts`.

## Test helpers

- `mount(SomeComponent, {env, target})`: create a component with the `env` provided,
  and mount it to the `target` html element. This method is asynchronous, and
  return the instance of the component

- `makeTestEnv(services?)`: create a test environment. It has no services by
  default, unless a service registry is provided.

- `getFixture()`: return an html element to use as a DOM node for tests (only
  applies to code that needs to interact with the DOM, obviously).

## Adding a new test

To add a new test file to the QUnit suite, the following steps need to be done:

1. create a new file named `something_test.ts` in the `static/tests` folder
2. import your file in `static/tests/main.ts` (so it will be added to the test bundle)
3. add your tests inside your new file.

Here is a simple example of a test file to test a component:

```ts
import * as QUnit from "qunit";
import { MyComponent } from "../../src/components/...";
import { getFixture, makeTestEnv, mount, OdooEnv } from "../helpers";

let target: HTMLElement;
let env: OdooEnv;
QUnit.module("MyComponent", {
  beforeEach() {
    target = getFixture();
    env = makeTestEnv();
  },
});

QUnit.test("can be rendered", async (assert) => {
  assert.expect(1);
  const myComponent = await mount(MyComponent, { env, target });
  // perform some assertion/actions
});
```
