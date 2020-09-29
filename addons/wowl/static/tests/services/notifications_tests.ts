import * as QUnit from "qunit";
import { Service } from "../../src/services";
import { NotificationManager, notificationService } from "../../src/services/notifications";
import { OdooEnv } from "../../src/env";
import { Registry } from "../../src/core/registry";
import { getFixture, makeTestEnv, mount, nextTick } from "../helpers";


let target: HTMLElement;
let browser: Partial<OdooEnv["browser"]>;
let services: Registry<Service>;

QUnit.module("Notifications", {
  async beforeEach() {
    target = getFixture();
    services = new Registry<Service>();
    services.add(notificationService.name, notificationService);
    browser = { setTimeout: () => 1 };
  },
});

QUnit.test("can display a basic notification", async (assert) => {
  assert.expect(4);

  const env = await makeTestEnv({ browser, services });
  await mount(NotificationManager, { env, target });
  const notifications = notificationService.deploy(env);

  env.bus.on('NOTIFICATIONS_CHANGE', null, (notifs) => {
    assert.strictEqual(notifs.length, 1);
  });
  notifications.display("I'm a basic notification");
  await nextTick();
  assert.containsOnce(target, '.o_notification');
  const notif: HTMLElement | null = target.querySelector('.o_notification');
  assert.strictEqual(notif!.innerText, "I'm a basic notification");
  assert.ok(notif!.classList.contains('bg-warning'));
});

QUnit.test("can display a notification of type danger", async (assert) => {
  const env = await makeTestEnv({ browser, services });
  await mount(NotificationManager, { env, target });
  const notifications = notificationService.deploy(env);

  notifications.display("I'm a danger notification", { type: 'danger' });
  await nextTick();
  assert.containsOnce(target, '.o_notification');
  const notif: HTMLElement | null = target.querySelector('.o_notification');
  assert.strictEqual(notif!.innerText, "I'm a danger notification");
  assert.ok(notif!.classList.contains('bg-danger'));
});

QUnit.test("can display a danger notification with a title", async (assert) => {
  const env = await makeTestEnv({ browser, services });
  await mount(NotificationManager, { env, target });
  const notifications = notificationService.deploy(env);

  notifications.display("I'm a danger notification", { title: 'Some title', type: 'danger' });
  await nextTick();
  assert.containsOnce(target, '.o_notification');
  const notif: HTMLElement | null = target.querySelector('.o_notification');
  assert.strictEqual((notif!.querySelector('.toast-header')! as HTMLElement).innerText, "Some title");
  assert.strictEqual((notif!.querySelector('.toast-body')! as HTMLElement).innerText, "I'm a danger notification");
  assert.ok(notif!.classList.contains('bg-danger'));
  assert.ok(notif!.querySelector('.o_notification_icon')!.classList.contains('fa-exclamation'));
});

QUnit.test("notifications aren't sticky by default", async (assert) => {
  let timeoutCB: any;
  browser.setTimeout = (cb) => {
    timeoutCB = cb;
    return 1;
  };
  const env = await makeTestEnv({ browser, services });
  await mount(NotificationManager, { env, target });
  const notifications = notificationService.deploy(env);

  notifications.display("I'm a notification");
  await nextTick();
  assert.containsOnce(target, '.o_notification');

  timeoutCB!(); // should close the notification
  await nextTick();
  assert.containsNone(target, '.o_notification');
});

QUnit.test("can display a sticky notification", async (assert) => {
  browser.setTimeout = () => {
    throw new Error("Should not register a callback for sticky notifications")
    return 1;
  };
  const env = await makeTestEnv({ browser, services });
  await mount(NotificationManager, { env, target });
  const notifications = notificationService.deploy(env);

  notifications.display("I'm a sticky notification", { sticky: true });
  await nextTick();
  assert.containsOnce(target, '.o_notification');
});
