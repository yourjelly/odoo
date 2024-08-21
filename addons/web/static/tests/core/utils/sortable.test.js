import { expect, getFixture, mountOnFixture, test } from "@odoo/hoot";
import { drag, queryAllTexts, queryFirst } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import { contains, mountWithCleanup } from "@web/../tests/web_test_helpers";

import { Component, reactive, useRef, useState, xml } from "@odoo/owl";
import { useSortable } from "@web/core/utils/sortable_owl";
import {advanceFrame, runAllTimers} from "../../../lib/hoot/hoot-mock";

test("Parameters error handling", async () => {
    const mountListAndAssert = async (setupList) => {
        class List extends Component {
            static props = ["*"];
            static template = xml`
                    <div t-ref="root" class="root">
                        <ul class="list">
                            <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="i" class="item" />
                        </ul>
                    </div>`;
            setup() {
                setupList();
            }
        }

        await mountWithCleanup(List);
    };

    // Incorrect params
    await mountListAndAssert(() => {
        expect(() => useSortable({})).toThrow(
            `Error in hook useSortable: missing required property "ref" in parameter`
        );
    });
    await mountListAndAssert(() => {
        expect(() =>
            useSortable({
                elements: ".item",
            })
        ).toThrow(`Error in hook useSortable: missing required property "ref" in parameter`);
    });
    await mountListAndAssert(() => {
        expect(() =>
            useSortable({
                elements: ".item",
                groups: ".list",
            })
        ).toThrow(`Error in hook useSortable: missing required property "ref" in parameter`);
    });

    // Correct params
    await mountListAndAssert(() => {
        useSortable({
            ref: useRef("root"),
        });
    });
    await mountListAndAssert(() => {
        useSortable({
            ref: {},
            elements: ".item",
            enable: false,
        });
    });
    await mountListAndAssert(() => {
        useSortable({
            ref: useRef("root"),
            elements: ".item",
            connectGroups: () => true,
        });
    });
});

test("Simple sorting in single group", async () => {
    expect.assertions(18);

    class List extends Component {
        static props = ["*"];
        static template = xml`
            <div t-ref="root" class="root">
                <ul class="list">
                    <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="i" class="item" />
                </ul>
            </div>`;
        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                onDragStart({ element, group }) {
                    expect.step("start");
                    expect(group).toBe(undefined);
                    expect(element).toHaveText("1");
                },
                onElementEnter({ element }) {
                    expect.step("elemententer");
                    expect(element).toHaveText("2");
                },
                onDragEnd({ element, group }) {
                    expect.step("end");
                    expect(group).toBe(undefined);
                    expect(element).toHaveText("1");
                    expect(".item").toHaveCount(4);
                    expect(".item.o_dragged").toHaveCount(1);
                },
                onDrop({ element, group, previous, next, parent }) {
                    expect.step("drop");
                    expect(group).toBe(undefined);
                    expect(element).toHaveText("1");
                    expect(previous).toHaveText("2");
                    expect(next).toHaveText("3");
                    expect(parent).toBe(null);
                },
            });
        }
    }

    await mountWithCleanup(List);

    expect(".item").toHaveCount(3);
    expect(".o_dragged").toHaveCount(0);
    expect.verifySteps([]);

    // First item after 2nd item
    await contains(".item:first-child").dragAndDrop(".item:nth-child(2)");

    expect(".item").toHaveCount(3);
    expect(".o_dragged").toHaveCount(0);
    expect.verifySteps(["start", "elemententer", "drop", "end"]);
});

test("Simple sorting in multiple groups", async () => {
    expect.assertions(16);

    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div t-ref="root" class="root">
                    <ul t-foreach="[1, 2, 3]" t-as="l" t-key="l" t-attf-class="list p-3 list{{ l }}">
                        <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="l + ' ' + i" class="item" />
                    </ul>
                </div>`;
        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                groups: ".list",
                connectGroups: true,
                onDragStart({ element, group }) {
                    expect.step("start");
                    expect(group).toHaveClass("list2");
                    expect(element).toHaveText("2 1");
                },
                onGroupEnter({ group }) {
                    expect.step("groupenter");
                    expect(group).toHaveClass("list1");
                },
                onDragEnd({ element, group }) {
                    expect.step("end");
                    expect(group).toHaveClass("list2");
                    expect(element).toHaveText("2 1");
                },
                onDrop({ element, group, previous, next, parent }) {
                    expect.step("drop");
                    expect(group).toHaveClass("list2");
                    expect(element).toHaveText("2 1");
                    expect(previous).toHaveText("1 3");
                    expect(next).toBe(null);
                    expect(parent).toHaveClass("list1");
                },
            });
        }
    }

    await mountWithCleanup(List);

    expect(".list").toHaveCount(3);
    expect(".item").toHaveCount(9);
    expect.verifySteps([]);

    // First item of 2nd list appended to first list
    await contains(".list2 .item:first-child").dragAndDrop(".list1");

    expect(".list").toHaveCount(3);
    expect(".item").toHaveCount(9);
    expect.verifySteps(["start", "groupenter", "drop", "end"]);
});
// TODO WAITING HOOT TO SUPPORT THIS CASE
test.debug("Sorting in groups with distinct per-axis scrolling", async () => {
    class List extends Component {
        static props = ["*"];
        static template = xml`
            <div class="w-100 h-100 start-0 top-0 position-fixed">
                <div class="scroll_parent_y overflow-x-hidden overflow-y-scroll" style="max-width: 150px; max-height: 200px;">
                    <div class="spacer_before" style="min-height: 50px;"></div>
                    <div class="spacer_horizontal" style="min-height: 50px;"></div>
                    <div t-ref="root" class="root d-flex align-items-end overflow-x-scroll">
                        <div class="d-flex">
                            <div style="padding-left: 20px;"
                                t-foreach="[1, 2, 3]" t-as="c" t-key="c" t-attf-class="list m-0 list{{ c }}">
                                <div style="min-width: 50px; min-height: 50px; padding-top: 20px;"
                                    t-foreach="[1, 2, 3]" t-as="l" t-key="l" t-esc="'item' + l + '' + c" t-attf-class="item item{{ l + '' + c }}"/>
                            </div>
                        </div>
                    </div>
                    <div class="spacer_after" style="min-height: 150px;"></div>
                </div>
            </div>
            `;
        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                groups: ".list",
                connectGroups: true,
                edgeScrolling: { speed: 0, threshold: 25 },
            });
        }
    }

    await mountOnFixture(List);
    await animationFrame();
    debugger;
    expect(".list").toHaveCount(3);
    expect(".item").toHaveCount(9);

    const cancelDrag = async ({ cancel }) => {
        await cancel();
        queryFirst(".scroll_parent_y").scrollTop = 0;
        queryFirst(".root").scrollLeft = 0;
        await animationFrame();
        expect(".o_dragged").toHaveCount(0);
    };
    expect(".o_dragged").toHaveCount(0);
    // Negative horizontal scrolling.
    queryFirst(".spacer_horizontal").scrollIntoView();
    queryFirst(".root").scrollLeft = 16;
    await animationFrame();
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 50, {
        message: "Negative horizontal scrolling: scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 16, {
        message: "Negative horizontal scrolling: scrollLeft",
    });
    let dragHelpers = await contains(".item12").drag();
    await dragHelpers.moveTo(".item11", { position: "left" });
    await animationFrame();
    await advanceFrame(33);
    await runAllTimers();
    await animationFrame();
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 50, {
        message: "Negative horizontal scrolling left - scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 0, {
        message: "Negative horizontal scrolling left - scrollLeft",
    });
    await cancelDrag(dragHelpers);

    // Positive horizontal scrolling.
    queryFirst(".spacer_horizontal").scrollIntoView();
    await animationFrame();
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 50, {
        message: "Positive horizontal scrolling - scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 0, {
        message: "Positive horizontal scrolling - scrollLeft",
    });
    dragHelpers = await contains(".item11").drag();
    await dragHelpers.moveTo(".item12", { position: "right" });
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 50, {
        message: "Positive horizontal scrolling right - scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 16, {
        message: "Positive horizontal scrolling right - scrollLeft",
    });
    await cancelDrag(dragHelpers);

    // Negative vertical scrolling.
    queryFirst(".root").scrollIntoView();
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 100, {
        message: "Negative vertical scrolling - scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 0, {
        message: "Negative vertical scrolling - scrollLeft",
    });
    dragHelpers = await contains(".item11").drag();
    await dragHelpers.moveTo(".item11:not(.o_dragged)", { position: "top" });
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 84, {
        message: "Negative vertical scrolling top - scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 0, {
        message: "Negative vertical scrolling top - scrollLeft",
    });
    await cancelDrag(dragHelpers);

    // Positive vertical scrolling.
    queryFirst(".spacer_before").scrollIntoView();
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 0, {
        message: "Positive vertical scrolling - scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 0, {
        message: "Positive vertical scrolling - scrollLeft",
    });
    dragHelpers = await contains(".item21").drag();
    await dragHelpers.moveTo(".item21:not(.o_dragged)", { position: "bottom" });
    expect(".scroll_parent_y").toHaveProperty("scrollTop", 16, {
        message: "Positive vertical scrolling bottom - scrollTop",
    });
    expect(".root").toHaveProperty("scrollLeft", 0, {
        message: "Positive vertical scrolling bottom - scrollLeft",
    });
    await cancelDrag(dragHelpers);
});

test("draggable area contains overflowing visible elements", async () => {
    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div class="controller" style="max-width: 900px; min-width: 900px;">
                    <div class="content" style="max-width: 600px;">
                        <div t-ref="renderer" class="renderer d-flex" style="overflow: visible;">
                            <div t-foreach="[1, 2, 3]" t-as="c" t-key="c" t-attf-class="list m-0 list{{ c }}">
                                <div style="min-width: 300px; min-height: 50px;"
                                    t-foreach="[1, 2, 3]" t-as="l" t-key="l" t-esc="'item' + l + '' + c" t-attf-class="item item{{ l + '' + c }}"/>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        setup() {
            useSortable({
                ref: useRef("renderer"),
                elements: ".item",
                groups: ".list",
                connectGroups: true,
            });
        }
    }
    await mountWithCleanup(List);

    const controller = queryFirst(".controller");
    const content = queryFirst(".content");
    const renderer = queryFirst(".renderer");

    expect(content).toHaveProperty("scrollLeft", 0);
    expect(controller.getBoundingClientRect().width).toBe(900);
    expect(content.getBoundingClientRect().width).toBe(600);
    expect(renderer.getBoundingClientRect().width).toBe(600);
    expect(renderer).toHaveProperty("scrollWidth", 900);
    expect(".item.o_dragged").toHaveCount(0);
    const { cancel, moveTo } = drag(".item11");

    // Drag first record of first group to the right
    moveTo(queryFirst(".list3 .item"));

    // Next frame (normal time delta)
    await animationFrame();

    // Verify that there is no scrolling
    expect(content).toHaveProperty("scrollLeft", 0);
    expect(".item.o_dragged").toHaveCount(1);

    const dragged = queryFirst(".item.o_dragged");
    const sibling = queryFirst(".list3 .item");
    // Verify that the dragged element is allowed to go inside the
    // overflowing part of the draggable container.
    expect(dragged.getBoundingClientRect().right).toBe(
        900 + getFixture().getBoundingClientRect().x
    );
    expect(sibling.getBoundingClientRect().right).toBe(
        900 + getFixture().getBoundingClientRect().x
    );

    // Cancel drag: press "Escape"
    cancel();
    await animationFrame();

    expect(".item.o_dragged").toHaveCount(0);
});

test("Dynamically disable sortable feature", async () => {
    expect.assertions(3);

    const state = reactive({ enableSortable: true });
    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div t-ref="root" class="root">
                    <ul class="list">
                        <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="i" class="item" />
                    </ul>
                </div>`;
        setup() {
            this.state = useState(state);
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                enable: () => this.state.enableSortable,
                onDragStart() {
                    expect.step("start");
                },
            });
        }
    }

    await mountWithCleanup(List);

    expect.verifySteps([]);

    // First item before last item
    await contains(".item:first-child").dragAndDrop(".item:last-child");

    // Drag should have occurred
    expect.verifySteps(["start"]);

    state.enableSortable = false;
    await animationFrame();

    // First item before last item
    await contains(".item:first-child").dragAndDrop(".item:last-child");

    // Drag shouldn't have occurred
    expect.verifySteps([]);
});

test("Drag has a default tolerance of 10 pixels before initiating the dragging", async () => {
    expect.assertions(2);

    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div t-ref="root" class="root">
                    <ul class="list">
                        <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="i" class="item" />
                    </ul>
                </div>`;

        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                onDragStart() {
                    expect.step("Initiation of the drag sequence");
                },
            });
        }
    }

    await mountWithCleanup(List);

    async function dnd(listItem, position) {
        const { drop, moveTo } = drag(listItem);
        moveTo(listItem, { position, relative: true });
        await animationFrame();
        drop();
    }
    const listItem = queryFirst(".item:first-child");

    // Move the element from only 5 pixels
    await dnd(listItem, {
        x: listItem.getBoundingClientRect().width / 2,
        y: listItem.getBoundingClientRect().height / 2 + 5,
    });
    // No drag sequence should have been initiated
    expect.verifySteps([]);

    // Move the element from more than 10 pixels
    await dnd(listItem, {
        x: listItem.getBoundingClientRect().width / 2 + 10,
        y: listItem.getBoundingClientRect().height / 2 + 10,
    });
    // A drag sequence should have been initiated
    expect.verifySteps(["Initiation of the drag sequence"]);
});

test("Ignore specified elements", async () => {
    expect.assertions(4);

    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div t-ref="root" class="root">
                    <ul class="list">
                        <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" class="item">
                            <span class="ignored" t-esc="i" />
                            <span class="not-ignored" t-esc="i" />
                        </li>
                    </ul>
                </div>`;
        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                ignore: ".ignored",
                onDragStart() {
                    expect.step("drag");
                },
            });
        }
    }

    await mountWithCleanup(List);

    expect.verifySteps([]);

    // Drag root item element
    await contains(".item:first-child").dragAndDrop(".item:nth-child(2)");

    expect.verifySteps(["drag"]);

    // Drag ignored element
    await contains(".item:first-child .not-ignored").dragAndDrop(".item:nth-child(2)");

    expect.verifySteps(["drag"]);

    // Drag non-ignored element
    await contains(".item:first-child .ignored").dragAndDrop(".item:nth-child(2)");

    expect.verifySteps([]);
});

test("the classes parameters (placeholderElement, helpElement)", async () => {
    expect.assertions(7);

    let dragElement;

    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div t-ref="root" class="root">
                    <ul class="list">
                        <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="i" class="item" />
                    </ul>
                </div>`;
        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                placeholderClasses: ["placeholder-t1", "placeholder-t2"],
                followingElementClasses: ["add-1", "add-2"],
                onDragStart({ element }) {
                    dragElement = element;
                    expect(dragElement).toHaveClass("add-1");
                    expect(dragElement).toHaveClass("add-2");
                    // the placeholder is added in onDragStart after the current element
                    const children = [...dragElement.parentElement.children];
                    const placeholder = children[children.indexOf(dragElement) + 1];
                    expect(placeholder).toHaveClass("placeholder-t1");
                    expect(placeholder).toHaveClass("placeholder-t2");
                },
            });
        }
    }

    await mountWithCleanup(List);
    // First item after 2nd item
    await contains(".item:first-child").dragAndDrop(".item:nth-child(2)");
    expect(dragElement).not.toHaveClass("add-1");
    expect(dragElement).not.toHaveClass("add-2");
    expect(".item.placeholder-t1.placeholder-t2").toHaveCount(0);
});

test("applyChangeOnDrop option", async () => {
    expect.assertions(2);

    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div t-ref="root" class="root">
                    <ul class="list">
                        <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="i" class="item" />
                    </ul>
                </div>`;
        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                placeholderClasses: ["placeholder"],
                applyChangeOnDrop: true,
                onDragStart() {
                    expect(queryAllTexts(".item:not(.placeholder)")).toEqual(["1", "2", "3"]);
                },
                onDrop() {
                    expect(queryAllTexts(".item:not(.placeholder)")).toEqual(["2", "1", "3"]);
                },
            });
        }
    }

    await mountWithCleanup(List);
    // First item after 2nd item
    await contains(".item:first-child").dragAndDrop(".item:nth-child(2)");
});

test("clone option", async () => {
    expect.assertions(2);

    class List extends Component {
        static props = ["*"];
        static template = xml`
                <div t-ref="root" class="root">
                    <ul class="list">
                        <li t-foreach="[1, 2, 3]" t-as="i" t-key="i" t-esc="i" class="item" />
                    </ul>
                </div>`;
        setup() {
            useSortable({
                ref: useRef("root"),
                elements: ".item",
                placeholderClasses: ["placeholder"],
                clone: false,
                onDragStart() {
                    expect(".placeholder:not(.item)").toHaveCount(1);
                },
            });
        }
    }

    await mountWithCleanup(List);
    // First item after 2nd item
    await contains(".item:first-child").dragAndDrop(".item:nth-child(2)");
    expect(".placeholder:not(.item)").toHaveCount(0);
});
