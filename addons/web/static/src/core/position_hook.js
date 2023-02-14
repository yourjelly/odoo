/** @odoo-module */

import { throttleForAnimation } from "./utils/timing";

import { onWillUnmount, useEffect, useExternalListener, useRef } from "@odoo/owl";
import { localization } from "@web/core/l10n/localization";

/**
 * @typedef {(popperElement: HTMLElement, solution: PositioningSolution) => void} PositionEventHandler
 */

/**
 * @typedef {{
 *  popper?: string;
 *  container?: HTMLElement | (() => HTMLElement);
 *  iframe?: HTMLIFrameElement;
 *  margin?: number;
 *  position?: Direction | Position;
 *  onPositioned?: PositionEventHandler;
 * }} Options
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
    popper: "popper",
    margin: 0,
    position: "bottom",
};

/**
 * Returns the best positioning solution staying in the container or falls back
 * to the requested position.
 * The positioning data used to determine each possible position is based on
 * the reference, popper, and container sizes.
 * Particularly, a popper must not overflow the container in any direction,
 * it should actually stay at `margin` distance from the border to look good.
 *
 * @param {HTMLElement} reference
 * @param {HTMLElement} popper
 * @param {Options} options
 * @returns {PositioningSolution} the best positioning solution
 */
function getBestPosition(reference, popper, { container, iframe, margin, position }) {
    // Retrieve directions and variants
    const [directionKey, variantKey = "middle"] = position.split("-");
    const directions =
        variantKey === "fit" ? FIT_FLIP_ORDER[directionKey] : DIRECTION_FLIP_ORDER[directionKey];
    const variants = VARIANT_FLIP_ORDER[variantKey];

    if (typeof container === "function") {
        container = container();
    }

    // Boxes
    const popBox = popper.getBoundingClientRect();
    const refBox = reference.getBoundingClientRect();
    const contBox = container.getBoundingClientRect();
    const iframeBox = iframe?.getBoundingClientRect() || { top: 0, left: 0 };

    const containerIsHTMLNode = container === container.ownerDocument.firstElementChild;

    // Compute positioning data
    /** @type {DirectionsData} */
    const directionsData = {
        t: iframeBox.top + refBox.top - popBox.height - margin,
        b: iframeBox.top + refBox.bottom + margin,
        r: iframeBox.left + refBox.right + margin,
        l: iframeBox.left + refBox.left - popBox.width - margin,
    };
    /** @type {VariantsData} */
    const variantsData = {
        vf: iframeBox.left + refBox.left,
        vs: iframeBox.left + refBox.left,
        vm: iframeBox.left + refBox.left + refBox.width / 2 + -popBox.width / 2,
        ve: iframeBox.left + refBox.right - popBox.width,
        hf: iframeBox.top + refBox.top,
        hs: iframeBox.top + refBox.top,
        hm: iframeBox.top + refBox.top + refBox.height / 2 + -popBox.height / 2,
        he: iframeBox.top + refBox.bottom - popBox.height,
    };

    function getPositioningData(d = directions[0], v = variants[0], containerRestricted = false) {
        const vertical = ["t", "b"].includes(d);
        const variantPrefix = vertical ? "v" : "h";
        const directionValue = directionsData[d];
        const variantValue = variantsData[variantPrefix + v];

        if (containerRestricted) {
            const [directionSize, variantSize] = vertical
                ? [popBox.height + margin, popBox.width]
                : [popBox.width, popBox.height + margin];
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
            ...positioning,
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
 * @param {HTMLElement} reference
 * @param {HTMLElement} popper
 * @param {Options} options
 */
export function reposition(reference, popper, options) {
    const [directionKey, variantKey = "middle"] = options.position.split("-");
    options = {
        container: reference.ownerDocument.documentElement,
        ...options,
    };

    // Reset popper style
    popper.style.position = "fixed";
    popper.style.top = "0px";
    popper.style.left = "0px";

    // Get best positioning solution and apply it
    const position = getBestPosition(reference, popper, options);
    const { top, left } = position;
    popper.style.top = `${top}px`;
    popper.style.left = `${left}px`;

    if (variantKey === "fit") {
        const styleProperty = ["top", "bottom"].includes(directionKey) ? "width" : "height";
        popper.style[styleProperty] = reference.getBoundingClientRect()[styleProperty] + "px";
    }

    if (options.onPositioned) {
        options.onPositioned(popper, position);
    }
}

/**
 * Makes sure that the `popper` element is always
 * placed at `position` from the `reference` element.
 * If doing so the `popper` element is clipped off `container`,
 * sensible fallback positions are tried.
 * If all of fallback positions are also clipped off `container`,
 * the original position is used.
 *
 * Note: The popper element should be indicated in your template with a t-ref reference.
 *       This could be customized with the `popper` option.
 *
 * @param {HTMLElement | (()=>HTMLElement)} reference
 * @param {Options} options
 */
export function usePosition(reference, options) {
    options = { ...DEFAULTS, ...options };
    const { popper, position } = options;

    let [directionKey, variantKey = "middle"] = position.split("-");

    if (localization.direction === "rtl") {
        if (["bottom", "top"].includes(directionKey)) {
            if (variantKey !== "middle") {
                variantKey = variantKey === "start" ? "end" : "start";
            }
        } else {
            directionKey = directionKey === "left" ? "right" : "left";
        }
        options.position = [directionKey, variantKey].join("-");
    }

    const popperRef = useRef(popper);
    const getReference = typeof reference === "function" ? reference : () => reference;
    const update = () => {
        const ref = getReference();
        if (popperRef.el && ref) {
            reposition(ref, popperRef.el, options);
        }
    };
    useEffect(update);
    const throttledUpdate = throttleForAnimation(update);
    useExternalListener(document, "scroll", throttledUpdate, { capture: true });
    useExternalListener(window, "resize", throttledUpdate);
    if (options.iframe) {
        const { contentWindow: iframeWindow } = options.iframe;
        useExternalListener(iframeWindow, "scroll", throttledUpdate, { capture: true });
    }
    onWillUnmount(throttledUpdate.cancel);
}
