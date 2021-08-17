/** @odoo-module **/

import { Calendar } from "@web/views/calendar/renderer/calendar";
import { makeEnv, makeFakeModel, mountComponent } from "./calendar_helpers";

function makeFakeCalendarRenderer(scale) {
    class FakeCalendarRenderer extends owl.Component {}
    FakeCalendarRenderer.template = owl.tags.xml`<div class="fake-renderer-${scale}" />`;
    return FakeCalendarRenderer;
}

class FakeCalendar extends Calendar {}
FakeCalendar.components = {
    day: makeFakeCalendarRenderer("day"),
    week: makeFakeCalendarRenderer("week"),
    month: makeFakeCalendarRenderer("month"),
    year: makeFakeCalendarRenderer("year"),
};

async function start(params = {}) {
    const { services, props, model: modelParams } = params;
    const env = await makeEnv(services);
    const model = makeFakeModel(modelParams);
    return await mountComponent(FakeCalendar, env, {
        model,
        createRecord() {},
        deleteRecord() {},
        editRecord() {},
        ...props,
    });
}

QUnit.module("Calendar");

QUnit.test("display day view", async (assert) => {
    const calendar = await start({ model: { scale: "day" } });
    assert.containsOnce(calendar.el, ".o-calendar");
    assert.containsOnce(calendar.el, ".fake-renderer-day");
});

QUnit.test("display week view", async (assert) => {
    const calendar = await start({ model: { scale: "week" } });
    assert.containsOnce(calendar.el, ".o-calendar");
    assert.containsOnce(calendar.el, ".fake-renderer-week");
});

QUnit.test("display month view", async (assert) => {
    const calendar = await start({ model: { scale: "month" } });
    assert.containsOnce(calendar.el, ".o-calendar");
    assert.containsOnce(calendar.el, ".fake-renderer-month");
});

QUnit.test("display year view", async (assert) => {
    const calendar = await start({ model: { scale: "year" } });
    assert.containsOnce(calendar.el, ".o-calendar");
    assert.containsOnce(calendar.el, ".fake-renderer-year");
});

QUnit.test("change view", async (assert) => {
    const calendar = await start({ model: { scale: "day" } });
    assert.containsOnce(calendar.el, ".o-calendar");
    assert.containsOnce(calendar.el, ".fake-renderer-day");

    await calendar.updateProps((p) => {
        p.model.scale = "week";
    });
    assert.containsOnce(calendar.el, ".fake-renderer-week");

    await calendar.updateProps((p) => {
        p.model.scale = "month";
    });
    assert.containsOnce(calendar.el, ".fake-renderer-month");

    await calendar.updateProps((p) => {
        p.model.scale = "year";
    });
    assert.containsOnce(calendar.el, ".fake-renderer-year");

    await calendar.updateProps((p) => {
        p.model.scale = "day";
    });
    assert.containsOnce(calendar.el, ".fake-renderer-day");
});
