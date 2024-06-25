import { isVisible } from "@odoo/hoot-dom";
import * as hoot from "@odoo/hoot-dom";
import { omit } from "@web/core/utils/objects";
import { tourState } from "./tour_state";
import { debounce } from "@web/core/utils/timing";
import { EventBus, validate } from "@odoo/owl";
import { callWithUnloadCheck, getScrollParent } from "./tour_utils";
import { utils } from "@web/core/ui/ui_service";
import { setupEventActions } from "@web/../lib/hoot-dom/helpers/events";
import { browser } from "@web/core/browser/browser";
import { TourHelpers } from "./tour_helpers";
import { session } from "@web/session";

const schema = {
    id: { type: String, optional: true },
    isActive: { type: Array, element: String, optional: true },
    trigger: { type: String },
    extra_trigger: { type: String, optional: true },
    alt_trigger: { type: String, optional: true },
    content: { type: [String, Object], optional: true }, //allow object for _t && markup
    position: { type: String, optional: true },
    edition: { type: String, optional: true },
    run: { type: [String, Function], optional: true },
    allowInvisible: { type: Boolean, optional: true },
    allowDisabled: { type: Boolean, optional: true },
    auto: { type: Boolean, optional: true },
    in_modal: { type: Boolean, optional: true },
    width: { type: Number, optional: true },
    timeout: { type: Number, optional: true },
    consumeVisibleOnly: { type: Boolean, optional: true },
    consumeEvent: { type: String, optional: true },
    mobile: { type: Boolean, optional: true },
    title: { type: String, optional: true },
    shadow_dom: { type: Boolean, optional: true },
    debugHelp: { type: String, optional: true },
    noPrepend: { type: Boolean, optional: true },
    pause: { type: Boolean, optional: true },
    break: { type: Boolean, optional: true },
};

export class TourStep {
    tour = "";
    content = "";
    element = null;
    state = {};
    stepDelay;
    keepWatchBrowser;
    showPointerDuration;

    constructor(data, tour) {
        if (!tour) {
            throw new Error(`StepTour instance must have a tour !`);
        }
        this.tour = tour;
        this.validateSchema(data);
        return this;
    }

    get canContinue() {
        const rootNode = this.element.getRootNode();
        this.state.isInDoc =
            rootNode instanceof ShadowRoot
                ? this.element.ownerDocument.contains(rootNode.host)
                : this.element.ownerDocument.contains(this.element);
        this.state.isElement =
            this.element instanceof this.element.ownerDocument.defaultView.Element ||
            this.element instanceof Element;
        this.state.isVisible = this.allowInvisible || isVisible(this.element);
        const isBlocked =
            document.body.classList.contains("o_ui_blocked") ||
            document.querySelector(".o_blockUI");
        this.state.isBlocked = !!isBlocked;
        this.state.isEnabled = this.allowDisabled || !this.element.disabled;
        this.state.canContinue = !!(
            this.state.isInDoc &&
            this.state.isElement &&
            this.state.isVisible &&
            this.state.isEnabled &&
            !this.state.isBlocked
        );
        return this.state.canContinue;
    }

    compileToMacro(mode, pointer) {
        this.mode = mode;
        return this.mode === "manual"
            ? this.compileToMacroManualMode(pointer)
            : this.compileToMacroAutoMode(pointer);
    }

    async tryToDoAction(action) {
        try {
            await action();
            this.state.hasRun = true;
        } catch (error) {
            this.throwError([error.message]);
        }
    }

    onConsummed() {
        //Step is passed, timeout can be cleared.
        tourState.set(this.tour.name, "stepState", this.myState);
        new EventBus().trigger("STEP-CONSUMMED", {
            tour: this.tour,
            step: this,
        });
    }

    /**
     * Check if a step is active dependant on step.isActive property
     * Note that when step.isActive is not defined, the step is active by default.
     * When a step is not active, it's just skipped and the tour continues to the next step.
     */
    get imActive() {
        const standardKeyWords = ["enterprise", "community", "mobile", "desktop", "auto", "manual"];
        const isActiveArray = Array.isArray(this.isActive) ? this.isActive : [];
        if (isActiveArray.length === 0) {
            return true;
        }
        const selectors = isActiveArray.filter((key) => !standardKeyWords.includes(key));
        if (selectors.length) {
            // if one of selectors is not found, step is skipped
            for (const selector of selectors) {
                const el = hoot.queryFirst(selector);
                if (!el) {
                    return false;
                }
            }
        }
        const checkMode =
            isActiveArray.includes(this.mode) ||
            (!isActiveArray.includes("manual") && !isActiveArray.includes("auto"));
        const edition =
            (session.server_version_info || "").at(-1) === "e" ? "enterprise" : "community";
        const checkEdition =
            isActiveArray.includes(edition) ||
            (!isActiveArray.includes("enterprise") && !isActiveArray.includes("community"));
        const onlyForMobile = isActiveArray.includes("mobile") && utils.isSmall();
        const onlyForDesktop = isActiveArray.includes("desktop") && !utils.isSmall();
        const checkDevice =
            onlyForMobile ||
            onlyForDesktop ||
            (!isActiveArray.includes("mobile") && !isActiveArray.includes("desktop"));
        return checkEdition && checkDevice && checkMode;
    }

    compileToMacroAutoMode(pointer) {
        const debugMode = tourState.get(this.tour.name, "debug");
        return [
            {
                action: () => {
                    setupEventActions(document.createElement("div"));
                    if (this.break && debugMode !== false) {
                        // eslint-disable-next-line no-debugger
                        debugger;
                    }
                },
            },
            {
                action: async () => {
                    console.log(
                        `Tour ${this.tour.name} on step (${this.index} / ${this.tour.steps.length}): '${this.describeMe}'`
                    );
                    // This delay is important for making the current set of tour tests pass.
                    // IMPROVEMENT: Find a way to remove this delay.
                    await new Promise((resolve) => requestAnimationFrame(resolve));
                    await new Promise((resolve) => browser.setTimeout(resolve, this.stepDelay));
                },
            },
            {
                trigger: async () => {
                    if (!this.imActive) {
                        this.run = () => {};
                        return hoot.queryFirst("body");
                    }
                    const { triggerEl, altEl, extraTriggerOkay } = await this.findTriggers();

                    this.element = extraTriggerOkay && (triggerEl || altEl);
                    if (!this.element) {
                        return false;
                    }

                    return this.canContinue && this.element;
                },
                action: async (stepEl) => {
                    tourState.set(this.tour.name, "currentIndex", this.index + 1);
                    if (this.showPointerDuration > 0) {
                        // Useful in watch mode.
                        pointer.pointTo(stepEl, this.step);
                        await new Promise((r) => browser.setTimeout(r, this.showPointerDuration));
                        pointer.hide();
                    }

                    // TODO: Delegate the following routine to the `ACTION_HELPERS` in the macro module.
                    const helpers = new TourHelpers(this.element);

                    let result;
                    if (typeof this.run === "function") {
                        const willUnload = await callWithUnloadCheck(async () => {
                            await this.tryToDoAction(() =>
                                // `this.anchor` is expected in many `step.run`.
                                this.run.call({ anchor: stepEl }, helpers)
                            );
                        });
                        result = willUnload && "will unload";
                    } else if (typeof this.run === "string") {
                        for (const todo of this.run.split("&&")) {
                            const m = String(todo)
                                .trim()
                                .match(/^(?<action>\w*) *\(? *(?<arguments>.*?)\)?$/);
                            await this.tryToDoAction(() =>
                                helpers[m.groups?.action](m.groups?.arguments)
                            );
                        }
                    }
                    return result;
                },
            },
            {
                action: () => {
                    this.onConsummed();
                },
            },
            {
                action: async () => {
                    if (this.pause && debugMode !== false) {
                        const styles = [
                            "background: black; color: white; font-size: 14px",
                            "background: black; color: orange; font-size: 14px",
                        ];
                        console.log(
                            `%cTour is paused. Use %cplay()%c to continue.`,
                            styles[0],
                            styles[1],
                            styles[0]
                        );
                        window.hoot = hoot;
                        await new Promise((resolve) => {
                            window.play = () => {
                                resolve();
                                delete window.play;
                                delete window.hoot;
                            };
                        });
                    }
                },
            },
        ];
    }

    compileToMacroManualMode(pointer) {
        let proceedWith = null;
        let removeListeners = () => {};

        return [
            {
                action: () => console.log(this.trigger),
            },
            {
                trigger: async () => {
                    removeListeners();
                    if (!this.imActive) {
                        return hoot.queryFirst("body");
                    }
                    if (proceedWith) {
                        return proceedWith;
                    }

                    const { triggerEl, altEl, extraTriggerOkay } = await this.findTriggers();

                    this.element = extraTriggerOkay && (triggerEl || altEl);

                    if (this.element && this.canContinue) {
                        this.consumeEvent = this.consumeEvent || this.consumeEventType;
                        const debouncedToggleOpen = debounce(pointer.showContent, 50, true);

                        const updatePointer = () => {
                            pointer.setState({
                                onMouseEnter: () => debouncedToggleOpen(true),
                                onMouseLeave: () => debouncedToggleOpen(false),
                            });
                            pointer.pointTo(this.anchorElement, this);
                        };

                        removeListeners = this.setupListeners({
                            onMouseEnter: () => pointer.showContent(true),
                            onMouseLeave: () => pointer.showContent(false),
                            onScroll: updatePointer,
                            onConsume: () => {
                                proceedWith = this.element;
                                pointer.hide();
                            },
                        });

                        updatePointer();
                    } else {
                        pointer.hide();
                    }
                },
                action: () => {
                    tourState.set(this.tour.name, "currentIndex", this.index + 1);
                    pointer.hide();
                    proceedWith = null;
                    this.onConsummed();
                },
            },
        ];
    }

    get anchorElement() {
        if (this.consumeEvent === "drag") {
            // jQuery-ui draggable triggers 'drag' events on the .ui-draggable element,
            // but the tip is attached to the .ui-draggable-handle element which may
            // be one of its children (or the element itself)
            return this.element.closest(".ui-draggable, .o_draggable");
        }
        if (
            this.consumeEvent === "input" &&
            !["textarea", "input"].includes(this.element.tagName.toLowerCase())
        ) {
            return this.element.closest("[contenteditable='true']");
        }
        if (this.consumeEvent === "sort") {
            // when an element is dragged inside a sortable container (with classname
            // 'ui-sortable'), jQuery triggers the 'sort' event on the container
            return this.element.closest(".ui-sortable, .o_sortable");
        }
        return this.element;
    }

    get consumeEventType() {
        if (!this.element) {
            return "click";
        }
        const { classList, tagName, type } = this.element;
        const tag = tagName.toLowerCase();
        // Many2one
        if (classList.contains("o_field_many2one")) {
            return "autocompleteselect";
        }
        // Inputs and textareas
        if (
            tag === "textarea" ||
            (tag === "input" &&
                (!type ||
                    [
                        "email",
                        "number",
                        "password",
                        "search",
                        "tel",
                        "text",
                        "url",
                        "date",
                        "range",
                    ].includes(type)))
        ) {
            if (
                utils.isSmall() &&
                this.element
                    .closest(".o_field_widget")
                    ?.matches(".o_field_many2one, .o_field_many2many")
            ) {
                return "click";
            }
            return "input";
        }

        // Drag & drop run command
        if (typeof this.run === "string" && /^drag_and_drop/.test(this.run)) {
            // this is a heuristic: the element has to be dragged and dropped but it
            // doesn't have class 'ui-draggable-handle', so we check if it has an
            // ui-sortable parent, and if so, we conclude that its event type is 'sort'
            if (this.element.closest(".ui-sortable")) {
                return "sort";
            }
            if (
                (/^drag_and_drop_native/.test(this.run) && classList.contains("o_draggable")) ||
                this.element.closest(".o_draggable") ||
                this.element.draggable
            ) {
                return "pointerdown";
            }
        }

        // Default: click
        return "click";
    }

    get describeMe() {
        return this.content ? `${this.content} (trigger: ${this.trigger})` : this.trigger;
    }

    get describeWhyFailed() {
        if (this.extra_trigger && !this.state.extraTriggerFound) {
            return `The cause is that extra trigger (${this.extra_trigger}) element cannot be found in DOM.`;
        } else if (!this.state.triggerFound) {
            return `The cause is that trigger (${this.trigger}) element cannot be found in DOM.`;
        } else if (this.alt_trigger && !this.state.altTriggerFound) {
            return `The cause is that alt(ernative) trigger (${this.alt_trigger}) element cannot be found in DOM.`;
        } else if (!this.state.isVisible) {
            return "Element has been found but isn't displayed. (Use 'step.allowInvisible: true,' if you want to skip this check)";
        } else if (!this.state.isEnabled) {
            return "Element has been found but is disabled. (If this step does not run action so that you only want to check that element is visible, you can use 'step.isCheck: true,')";
        } else if (this.state.isBlocked) {
            return "Element has been found but DOM is blocked by UI.";
        } else if (!this.state.hasRun) {
            return `Element has been found. The error seems to be with step.run`;
        }
        return "";
    }

    get describeFailedSimple() {
        return `Tour ${this.tour.name} failed at step ${this.describeMe}`;
    }

    /**
     * @param {TourStep} step
     * @param {Tour} tour
     */
    get describeFailedDetailed() {
        const steps = this.tour.steps;
        const offset = 3;
        const start = Math.max(this.index - offset, 0);
        const end = Math.min(this.index + offset, steps.length);
        const result = [this.describeFailedSimple];
        for (let i = start; i < end; i++) {
            const stepString =
                JSON.stringify(
                    omit(steps[i], "state"),
                    (_key, value) => {
                        if (typeof value === "function") {
                            return "[function]";
                        } else {
                            return value;
                        }
                    },
                    2
                ) + ",";
            const text = [stepString];
            if (i === this.index) {
                const line = "-".repeat(10);
                const failing_step = `${line} FAILING STEP (${i}/${steps.length}) ${line}`;
                text.unshift(failing_step);
                text.push("-".repeat(failing_step.length));
            }
            result.push(...text);
        }
        return result.join("\n");
    }

    get myState() {
        const checkRun =
            (["string", "function"].includes(typeof this.run) && this.state.hasRun) || !this.run;
        const check = checkRun && this.state.canContinue;
        return check ? "succeeded" : "errored";
    }

    async tryFindTrigger(elKey) {
        const selector = this[elKey];
        if (!selector) {
            return;
        }
        const timeout = (this.timeout || 10000) + this.stepDelay;
        try {
            return await hoot.waitFor(selector, { timeout });
        } catch (error) {
            this.throwError([`${elKey} was not found : ${selector} : ${error.message}`]);
        }
    }

    async findTriggers() {
        const triggerEl = await this.tryFindTrigger("trigger");
        const altEl = await this.tryFindTrigger("alt_trigger");
        const extraEl = await this.tryFindTrigger("extra_trigger");
        this.state = this.state || {};
        this.state.triggerFound = !!triggerEl;
        this.state.altTriggerFound = !!altEl;
        this.state.extraTriggerFound = this.extra_trigger ? !!extraEl : true;
        // `extraTriggerOkay` should be true when `step.extra_trigger` is undefined.
        // No need for it to be in the modal.
        const extraTriggerOkay = this.state.extraTriggerFound;
        return { triggerEl, altEl, extraEl, extraTriggerOkay };
    }

    /**
     * @param {Object} params
     * @param {HTMLElement} params.anchorEl
     * @param {string} params.consumeEvent
     * @param {() => void} params.onMouseEnter
     * @param {() => void} params.onMouseLeave
     * @param {(ev: Event) => any} params.onScroll
     * @param {(ev: Event) => any} params.onConsume
     */
    setupListeners({ onMouseEnter, onMouseLeave, onScroll, onConsume }) {
        this.anchorElement.addEventListener(this.consumeEvent, onConsume);
        this.anchorElement.addEventListener("mouseenter", onMouseEnter);
        this.anchorElement.addEventListener("mouseleave", onMouseLeave);

        const cleanups = [
            () => {
                this.anchorElement.removeEventListener(this.consumeEvent, onConsume);
                this.anchorElement.removeEventListener("mouseenter", onMouseEnter);
                this.anchorElement.removeEventListener("mouseleave", onMouseLeave);
            },
        ];

        const scrollEl = getScrollParent(this.anchorElement);
        if (scrollEl) {
            const debouncedOnScroll = debounce(onScroll, 50);
            scrollEl.addEventListener("scroll", debouncedOnScroll);
            cleanups.push(() => scrollEl.removeEventListener("scroll", debouncedOnScroll));
        }

        return () => {
            while (cleanups.length) {
                cleanups.pop()();
            }
        };
    }

    /**
     * @param {TourStep} step
     * @param {Tour} tour
     * @param {Array<string>} [errors]
     */
    throwError(errors = []) {
        console.warn(this.describeFailedDetailed);
        console.error(`${this.describeFailedSimple}. ${this.describeWhyFailed}`);
        if (errors.length) {
            console.error(errors.join(", "));
        }
        if (tourState.get(this.tour.name, "debug") !== false) {
            // eslint-disable-next-line no-debugger
            debugger;
        }
    }

    validateSchema(data) {
        try {
            validate(data, schema);
            Object.assign(this, data);
            return true;
        } catch (error) {
            console.error(`Error for step ${JSON.stringify(data, null, 4)}\n${error.message}`);
            return false;
        }
    }
}
