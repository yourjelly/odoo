/** @odoo-module **/

export const generateUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

export const getElementAtPosition = (x, y, elements) => {
    const newElements = [...elements].reverse();
    return newElements
        .map((element) => ({
            ...element,
            position: positionWithinElement(x, y, element),
        }))
        .find((element) => element.position !== null);
};

const distance = (a, b) =>
    Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));

const onLine = (x1, y1, x2, y2, x, y, maxDistance = 1) => {
    const a = { x: x1, y: y1 };
    const b = { x: x2, y: y2 };
    const c = { x, y };
    const offset = distance(a, b) - (distance(a, c) + distance(b, c));
    return Math.abs(offset) < maxDistance ? "inside" : null;
};

const positionWithinElement = (x, y, element) => {
    const { type } = element;
    const { x1, x2, y1, y2 } = element.options;
    switch (type) {
        case "Line":
            const on = onLine(x1, y1, x2, y2, x, y);
            const start = nearPoint(x, y, x1, y1, "start");
            const end = nearPoint(x, y, x2, y2, "end");
            return start || end || on;
        case "Rect":
        case "Text":
        case "Image":
            const topLeft = nearPoint(x, y, x1, y1, "tl");
            const topRight = nearPoint(x, y, x2, y1, "tr");
            const bottomLeft = nearPoint(x, y, x1, y2, "bl");
            const bottomRight = nearPoint(x, y, x2, y2, "br");
            const inside =
                x >= x1 && x <= x2 && y >= y1 && y <= y2 ? "inside" : null;
            return topLeft || topRight || bottomLeft || bottomRight || inside;
        case "Circle":
            return positionWithinEllipse(x, y, element.options);
        case "Brush":
            const betweenAnyPoint = element.options.some((option, index) => {
                const nextPoint = element.options[index + 1];
                if (!nextPoint) return false;
                return onLine(option.x, option.y, nextPoint.x, nextPoint.y, x, y, 5) != null;
            });
            return betweenAnyPoint ? "inside" : null;
    }
};

const positionWithinEllipse = (x, y, options) => {
    const { x1, y1, x2, y2 } = options;
    const boundingRect = {
        tl: { x: x1, y: y1 },
        tr: { x: x2, y: y1 },
        bl: { x: x1, y: y2 },
        br: { x: x2, y: y2 },
    };

    for (const [corner, point] of Object.entries(boundingRect)) {
        if (nearPoint(x, y, point.x, point.y, corner)) return corner;
    }

    const cx = (x1 + x2) / 2;
    const cy = (y1 + y2) / 2;
    const rx = Math.abs(x2 - x1) / 2;
    const ry = Math.abs(y2 - y1) / 2;
    const value =
        Math.pow(x - cx, 2) / Math.pow(rx, 2) +
        Math.pow(y - cy, 2) / Math.pow(ry, 2);
    if (value <= 1) {
        return "inside";
    }
    return null;
};

const nearPoint = (x, y, x1, y1, name) => {
    return Math.abs(x - x1) < 5 && Math.abs(y - y1) < 5 ? name : null;
};

export const cursorForPosition = (position) => {
    switch (position) {
        case "tl":
        case "br":
        case "start":
        case "end":
            return "nwse-resize";
        case "tr":
        case "bl":
            return "nesw-resize";
        default:
            return "move";
    }
};

export const resizedCoordinates = (clientX, clientY, position, coordinates) => {
    const { x1, y1, x2, y2 } = coordinates;
    switch (position) {
        case "tl":
        case "start":
            return { x1: clientX, y1: clientY, x2, y2 };
        case "tr":
            return { x1, y1: clientY, x2: clientX, y2 };
        case "bl":
            return { x1: clientX, y1, x2, y2: clientY };
        case "br":
        case "end":
            return { x1, y1, x2: clientX, y2: clientY };
        default:
            return null;
    }
};

export const adjustElementCoordinates = (element) => {
    const { type } = element;
    const { x1, y1, x2, y2 } = element.options;
    if (type === "Line") {
        if (x1 < x2 || (x1 === x2 && y1 < y2)) {
            return { x1, y1, x2, y2 };
        } else {
            return { x1: x2, y1: y2, x2: x1, y2: y1 };
        }
    } else {
        const minX = Math.min(x1, x2);
        const maxX = Math.max(x1, x2);
        const minY = Math.min(y1, y2);
        const maxY = Math.max(y1, y2);
        return { x1: minX, y1: minY, x2: maxX, y2: maxY };
    }
};

export const adjustmentRequired = (type) =>
    ["Line", "Rect", "Circle"].includes(type);

const drawCircle = (ctx, x, y, radius) => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
};

export const highlightSelectedElement = (canvas, element) => {
    const ctx = canvas.el.getContext("2d");
    const { x1, y1, x2, y2 } = element.options;
    ctx.strokeStyle = "#6AC5FE";
    ctx.lineWidth = 1;

    switch (element.type) {
        case "Line":
            drawCircle(ctx, x1, y1, 5);
            drawCircle(ctx, x2, y2, 5);
            break;
        case "Rect":
        case "Text":
        case "Image":
            ctx.strokeRect(x1 - 5, y1 - 5, x2 - x1 + 10, y2 - y1 + 10);
            drawCircle(ctx, x1 - 5, y1 - 5, 5);
            drawCircle(ctx, x2 + 5, y1 - 5, 5);
            drawCircle(ctx, x1 - 5, y2 + 5, 5);
            drawCircle(ctx, x2 + 5, y2 + 5, 5);
            break;
        case "Circle":
            drawBoundingRectangle(ctx, element.options);
    }
};

export const deepCopy = (obj) => {
    if (obj === undefined || obj === null) {
        return null;
    }
    return JSON.parse(JSON.stringify(obj));
};

const drawBoundingRectangle = (ctx, options) => {
    const { x1, y1, x2, y2 } = options;
    ctx.strokeStyle = "#6AC5FE";
    ctx.lineWidth = 1;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    drawCircle(ctx, x1 - 5, y1 - 5, 5);
    drawCircle(ctx, x2 + 5, y1 - 5, 5);
    drawCircle(ctx, x1 - 5, y2 + 5, 5);
    drawCircle(ctx, x2 + 5, y2 + 5, 5);
};

export const clearCanvas = (canvas) => {
    const ctx = canvas.el.getContext("2d");
    ctx.clearRect(0, 0, canvas.el.width, canvas.el.height);
};
