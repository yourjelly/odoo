/** @odoo-module **/


import { resizedCoordinates } from "./helper.js";

export function createElement(elements, id, type, options, addons = []) {
    const element = {
        id: id || elements.length + 1,
        type,
        options,
        addons,
    };
    elements.push(element);
    return element;
}

export function updateElement(elements, id, type, options, addons = []) {
    const element = elements[id];
    if (element) {
        element.type = type;
        element.options = options;
        element.addons = addons;
    }
}

export function getMousePos(canvas, event) {
    const rect = canvas.el.getBoundingClientRect();
    return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
    };
}

export function drawAndSaveText(elements, x, y, text) {
    const id = elements.length + 1;
    const textLength = text.length;
    const rectX1 = x - 5;
    const rectY1 = y - 5;
    const rectX2 = x + textLength * 12 + 5;
    const rectY2 = y + 30 + 5;

    const options = {
        x1: rectX1,
        y1: rectY1,
        x2: rectX2,
        y2: rectY2,
    };

    const addons = {
        text,
    };

    return createElement(elements, id, "Text", options, addons);
}

export function resizeElement(elements, id, x, y, position, options) {
    const newOptions = resizedCoordinates(x, y, position, options);
    updateElement(elements, id, null, newOptions, null);
}

