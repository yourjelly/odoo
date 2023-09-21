/** @odoo-module */

import { batched, useThrottleForAnimation } from "./utils/timing";
import {
    EventBus,
    onWillDestroy,
    useChildSubEnv,
    useComponent,
    useEffect,
    useRef,
} from "@odoo/owl";
import { localization } from "@web/core/l10n/localization";
import { uniqueId } from "./utils/functions";

/**
 * @typedef {(popperElement: HTMLElement, solution: PositioningSolution) => void} PositionEventHandler
 */

/**
 * @typedef Options
 * @property {HTMLElement} [container] container element
 * @property {boolean} [holdOnFocus=false]
 * @property {number} [margin=0]
 *  margin in pixels between the popper and the target.
 * @property {Direction | Position} [position="bottom"]
 *  position of the popper relative to the target
 * @property {Boolean} [fixedPosition]
 *  the popper won't be repositioned if set to true
 * @property {Boolean} [displayArrow]
 *  the popper will have an arrow pointing towards its reference if set to true
 * @property {number} [animationTime=0]
 *  duration of animations in ms
 * @property {PositionEventHandler} [onPositioned]
 *  callback called everytime the popper has just been positioned
 *
 * @typedef {keyof DirectionsData} DirectionsDataKey
 * @typedef {{
 *  t: number;
 *  b: number;
 *  l: number;
 *  r: number;
 * }} DirectionsData
 *
 * @typedef {keyof VariantsData} VariantsDataKey
 * @typedef {{
 *  vs: number;
 *  vm: number;
 *  ve: number;
 *  hs: number;
 *  hm: number;
 *  he: number;
 * }} VariantsData
 *
 * @typedef {"top" | "left" | "bottom" | "right"} Direction
 * @typedef {"start" | "middle" | "end" | "fit"} Variant
 *
 * @typedef {{[direction in Direction]: string}} DirectionFlipOrder
 *  values are successive DirectionsDataKey represented as a single string
 *
 * @typedef {{[variant in Variant]: string}} VariantFlipOrder
 *  values are successive VariantsDataKey represented as a single string
 *
 * @typedef {`${Direction}-${Variant}`} Position
 *
 * @typedef {{
 *  top: number,
 *  left: number,
 *  direction: Direction,
 *  variant: Variant,
 * }} PositioningSolution
 */

/** @type {{[d: string]: Direction}} */
const DIRECTIONS = { t: "top", r: "right", b: "bottom", l: "left" };
/** @type {{[v: string]: Variant}} */
const VARIANTS = { s: "start", m: "middle", e: "end", f: "fit" };
/** @type DirectionFlipOrder */
const DIRECTION_FLIP_ORDER = { top: "tbrl", right: "rltb", bottom: "btrl", left: "lrbt" };
/** @type VariantFlipOrder */
const VARIANT_FLIP_ORDER = { start: "sme", middle: "mse", end: "ems", fit: "f" };
/** @type DirectionFlipOrder */
const FIT_FLIP_ORDER = { top: "tb", right: "rl", bottom: "bt", left: "lr" };

/** @type {Options} */
const DEFAULTS = {
    margin: 0,
    position: "bottom",
    sync() {},
};

const RE_CLEANUP = /^(bs-popover-)|(o-popover-)/g;

/**
 * @param {HTMLElement} el
 * @returns {HTMLIFrameElement?}
 */
function getIFrame(el) {
    const parentDocument = el.ownerDocument.defaultView.parent?.document;
    if (!parentDocument || parentDocument === el.ownerDocument) {
        return;
    }
    return [...parentDocument.getElementsByTagName("iframe")].find((iframe) =>
        iframe.contentDocument.contains(el)
    );
}

/**
 * Returns the best positioning solution staying in the container or falls back
 * to the requested position.
 * The positioning data used to determine each possible position is based on
 * the target, popper, and container sizes.
 * Particularly, a popper must not overflow the container in any direction.
 * The popper will stay at `margin` distance from its target. One could also
 * use the CSS margins of the popper element to achieve the same result.
 *
 * @param {HTMLElement} target
 * @param {HTMLElement} popper
 * @param {HTMLIFrameElement?} [iframe]
 * @param {Options} options
 * @returns {PositioningSolution} the best positioning solution, relative to
 *                                the containing block of the popper.
 *                                => can be applied to popper.style.(top|left)
 */
function getBestPosition(target, popper, iframe, { container, displayArrow, margin, position }) {
    // Retrieve directions and variants
    const [directionKey, variantKey = "middle"] = position.split("-");
    const directions =
        variantKey === "fit" ? FIT_FLIP_ORDER[directionKey] : DIRECTION_FLIP_ORDER[directionKey];
    const variants = VARIANT_FLIP_ORDER[variantKey];

    // Retrieve container
    if (!container) {
        container = target.ownerDocument.documentElement;
    } else if (typeof container === "function") {
        container = container();
    }

    // Account for popper actual margins
    const popperStyle = getComputedStyle(popper);
    const { marginTop, marginLeft, marginRight, marginBottom } = popperStyle;
    const popMargins = {
        top: parseFloat(marginTop),
        left: parseFloat(marginLeft),
        right: parseFloat(marginRight),
        bottom: parseFloat(marginBottom),
    };

    // Boxes
    const popBox = popper.getBoundingClientRect();
    const targetBox = target.getBoundingClientRect();
    const contBox = container.getBoundingClientRect();
    const shouldAccountForIFrame = iframe && popper.ownerDocument !== target.ownerDocument;
    const iframeBox = shouldAccountForIFrame ? iframe.getBoundingClientRect() : { top: 0, left: 0 };

    const containerIsHTMLNode = container === container.ownerDocument.firstElementChild;

    // Compute positioning data
    /** @type {DirectionsData} */
    const directionsData = {
        t: iframeBox.top + targetBox.top - popMargins.bottom - margin - popBox.height,
        b: iframeBox.top + targetBox.bottom + popMargins.top + margin,
        r: iframeBox.left + targetBox.right + popMargins.left + margin,
        l: iframeBox.left + targetBox.left - popMargins.right - margin - popBox.width,
    };
    /** @type {VariantsData} */
    const variantsData = {
        vf: iframeBox.left + targetBox.left,
        vs: iframeBox.left + targetBox.left + popMargins.left,
        vm: iframeBox.left + targetBox.left + targetBox.width / 2 - popBox.width / 2,
        ve: iframeBox.left + targetBox.right - popMargins.right - popBox.width,
        hf: iframeBox.top + targetBox.top,
        hs: iframeBox.top + targetBox.top + popMargins.top,
        hm: iframeBox.top + targetBox.top + targetBox.height / 2 - popBox.height / 2,
        he: iframeBox.top + targetBox.bottom - popMargins.bottom - popBox.height,
    };

    function getPositioningData(d = directions[0], v = variants[0], containerRestricted = false) {
        const vertical = ["t", "b"].includes(d);
        const variantPrefix = vertical ? "v" : "h";
        const arrowOffset = ["b", "r"].includes(d) ? 8 : -8;
        const directionValue = displayArrow ? directionsData[d] + arrowOffset : directionsData[d];
        const variantValue = variantsData[variantPrefix + v];

        if (containerRestricted) {
            const [directionSize, variantSize] = vertical
                ? [popBox.height, popBox.width]
                : [popBox.width, popBox.height];
            let [directionMin, directionMax] = vertical
                ? [contBox.top, contBox.bottom]
                : [contBox.left, contBox.right];
            let [variantMin, variantMax] = vertical
                ? [contBox.left, contBox.right]
                : [contBox.top, contBox.bottom];

            if (containerIsHTMLNode) {
                if (vertical) {
                    directionMin += container.scrollTop;
                    directionMax += container.scrollTop;
                } else {
                    variantMin += container.scrollTop;
                    variantMax += container.scrollTop;
                }
            }

            // Abort if outside container boundaries
            const directionOverflow =
                Math.ceil(directionValue) < Math.floor(directionMin) ||
                Math.floor(directionValue + directionSize) > Math.ceil(directionMax);
            const variantOverflow =
                Math.ceil(variantValue) < Math.floor(variantMin) ||
                Math.floor(variantValue + variantSize) > Math.ceil(variantMax);
            if (directionOverflow || variantOverflow) {
                return null;
            }
        }

        const positioning = vertical
            ? {
                  top: directionValue,
                  left: variantValue,
              }
            : {
                  top: variantValue,
                  left: directionValue,
              };
        return {
            // Subtract the offsets of the containing block (relative to the
            // viewport). It can be done like that because the style top and
            // left were reset to 0px in `reposition`
            // https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block#identifying_the_containing_block
            top: positioning.top - popBox.top,
            left: positioning.left - popBox.left,
            direction: DIRECTIONS[d],
            variant: VARIANTS[v],
        };
    }

    // Find best solution
    for (const d of directions) {
        for (const v of variants) {
            const match = getPositioningData(d, v, true);
            if (match) {
                // Position match have been found.
                return match;
            }
        }
    }

    // Fallback to default position if no best solution found
    return getPositioningData();
}

/**
 * This method will try to position the popper as requested (according to options).
 * If the requested position does not fit the container, other positions will be
 * tried in different direction and variant flip orders (depending on the requested position).
 * If no position is found that fits the container, the requested position stays used.
 *
 * When the final position is applied, a corresponding CSS class is also added to the popper.
 * This could be used to further styling.
 *
 * @param {HTMLElement} target
 * @param {HTMLElement} popper
 * @param {HTMLIFrameElement} [iframe]
 * @param {Options} options
 * @param {PositioningSolution} [lastPosition]
 * @returns {PositioningSolution|Promise<PositioningSolution>}
 */
export function reposition(target, popper, iframe, options, lastPosition = null) {
    let [directionKey, variantKey = "middle"] = options.position.split("-");
    if (localization.direction === "rtl") {
        if (["bottom", "top"].includes(directionKey)) {
            if (variantKey !== "middle") {
                variantKey = variantKey === "start" ? "end" : "start";
            }
        } else {
            directionKey = directionKey === "left" ? "right" : "left";
        }
    }
    options.position = [directionKey, variantKey].join("-");

    // Reset popper style
    popper.classList.forEach((c) => RE_CLEANUP.test(c) && popper.classList.remove(c));
    popper.style.position = "fixed";
    popper.style.top = "0px";
    popper.style.left = "0px";

    // Display arrow ?
    let arrow = popper.querySelector(":scope > .popover-arrow");
    if (options.displayArrow && !arrow) {
        // Make use of bootstrap style
        popper.classList.add("popover");
        arrow = popper.ownerDocument.createElement("div");
        arrow.classList = "popover-arrow";
        popper.appendChild(arrow);
    }

    // Get best positioning solution and apply it
    const position = getBestPosition(target, popper, iframe, options);
    const { top, left, direction, variant } = position;
    popper.style.top = `${top}px`;
    popper.style.left = `${left}px`;

    if (variant === "fit") {
        const styleProperty = ["top", "bottom"].includes(direction) ? "width" : "height";
        popper.style[styleProperty] = target.getBoundingClientRect()[styleProperty] + "px";
    }

    if (arrow) {
        // reset all popover classes
        const positionCode = `${direction[0]}${variant[0]}`;
        const bsDirection = {
            top: "top",
            bottom: "bottom",
            left: "start",
            right: "end",
        }[direction];
        popper.classList.add(
            `bs-popover-${bsDirection}`,
            `o-popover-${direction}`,
            `o-popover--${positionCode}`
        );
        arrow.className = "popover-arrow";
        switch (positionCode) {
            case "tm": // top-middle
            case "bm": // bottom-middle
            case "tf": // top-fit
            case "bf": // bottom-fit
                arrow.classList.add("start-0", "end-0", "mx-auto");
                break;
            case "lm": // left-middle
            case "rm": // right-middle
            case "lf": // left-fit
            case "rf": // right-fit
                arrow.classList.add("top-0", "bottom-0", "my-auto");
                break;
            case "ts": // top-start
            case "bs": // bottom-start
                arrow.classList.add("end-auto");
                break;
            case "te": // top-end
            case "be": // bottom-end
                arrow.classList.add("start-auto");
                break;
            case "ls": // left-start
            case "rs": // right-start
                arrow.classList.add("bottom-auto");
                break;
            case "le": // left-end
            case "re": // right-end
                arrow.classList.add("top-auto");
                break;
        }
    }

    if (lastPosition || !options.animationTime) {
        // BOI TODO, remove lastPosition condition
        // No animation wanted in these cases
        options.onPositioned?.(popper, position);
        return position;
    }

    // Animate
    const transform = {
        top: ["translateY(-5%)", "translateY(0)"],
        right: ["translateX(5%)", "translateX(0)"],
        bottom: ["translateY(5%)", "translateY(0)"],
        left: ["translateX(-5%)", "translateX(0)"],
    }[direction];
    const animation = popper.animate({ opacity: [0, 1], transform }, options.animationTime);
    const prom = animation.finished;
    return prom.then(() => {
        options.onPositioned?.(popper, position);
        return position;
    });
}

const POSITION_BUS = Symbol("position-bus");

/**
 * Makes sure that the `popper` element is always
 * placed at `position` from the `target` element.
 * If doing so the `popper` element is clipped off `container`,
 * sensible fallback positions are tried.
 * If all of fallback positions are also clipped off `container`,
 * the original position is used.
 *
 * Note: The popper element should be indicated in your template with a t-ref reference.
 *       This could be customized with the `popper` option.
 *
 * @param {string} refName
 * @param {() => HTMLElement} getTarget
 * @param {() => Options} [getOptions]
 */
export function usePosition(refName, getTarget, getOptions = () => DEFAULTS) {
    const component = useComponent();
    const ref = useRef(refName);
    let wasPositioned = false;
    let focusInside;
    let currentArgs = null;
    let options;
    const __NAME = uniqueId(component.constructor.name);
    let __COUNT = 0;
    let last;
    const update = batched(
        /**
         * @param {CustomEvent<Event?>} param0
         */
        ({ detail: innerEvent }) => {
            const [target, el, iframe] = currentArgs;
            if (innerEvent?.type === "scroll" && el.contains(innerEvent?.target)) {
                // In case the scroll event occurs inside the popper, do not reposition
                return;
            }

            const currentOptions = { ...DEFAULTS, ...options };
            if (currentOptions.fixedPosition && wasPositioned) {
                // in case we have fixedPosition set to true, we only want to position the popover once,
                // and then ignore subsequent reposition events
                return;
            }

            if (currentOptions.holdOnFocus && focusInside) {
                return;
            }

            const __LABEL = `[${__NAME}] reposition ${++__COUNT}`;
            console.time(__LABEL);
            last = reposition(target, el, iframe, options, last);
            wasPositioned = true; // BOI TODO probably needs set to false at some point
            console.log(last);
            console.timeEnd(__LABEL);
        },
        async () => {
            await last; // await last positioning (i.e. animation)
            await options.sync(); // await sync option BOI TODO, remove the above and keep this
        }
    );

    const bus = component.env[POSITION_BUS] || new EventBus();
    bus.addEventListener("update", update);
    onWillDestroy(() => bus.removeEventListener("update", update));

    const isTopmost = !(POSITION_BUS in component.env);
    if (isTopmost) {
        useChildSubEnv({ [POSITION_BUS]: bus });
    }

    const throttledUpdate = useThrottleForAnimation((e) => bus.trigger("update", e));
    useEffect(() => {
        const { el } = ref;
        const target = getTarget();
        if (!el || !target) {
            return;
        }
        options = getOptions(el, target);
        if (!options) {
            // No compute needed
            return;
        }
        options = { ...DEFAULTS, ...options };
        currentArgs = [target, el, getIFrame(target)];

        focusInside = el?.contains(el.ownerDocument.activeElement);
        const onPopperEnter = () => (focusInside = true);
        const onPopperLeave = (ev) => {
            focusInside = false;
            throttledUpdate(ev);
        };
        el?.addEventListener("pointerenter", onPopperEnter);
        el?.addEventListener("pointerleave", onPopperLeave);

        const targetDocument = target.ownerDocument;
        if (isTopmost) {
            // Attach listeners to keep the positioning up to date
            targetDocument?.addEventListener("scroll", throttledUpdate, { capture: true });
            targetDocument?.addEventListener("load", throttledUpdate, { capture: true });
            window.addEventListener("resize", throttledUpdate);
        }

        // Reposition
        bus.trigger("update");

        return () => {
            el?.removeEventListener("pointerenter", onPopperEnter);
            el?.removeEventListener("pointerleave", onPopperLeave);
            if (isTopmost) {
                targetDocument?.removeEventListener("scroll", throttledUpdate, { capture: true });
                targetDocument?.removeEventListener("load", throttledUpdate, { capture: true });
                window.removeEventListener("resize", throttledUpdate);
            }
        };
    });
}
