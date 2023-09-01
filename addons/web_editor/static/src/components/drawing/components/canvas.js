/** @odoo-module **/

const { Component, xml, useState, useRef, onMounted, useEffect } = owl;
import ShapeDrawer from "./ui/shapeDrawer.js";
import {
    getElementAtPosition,
    cursorForPosition,
    adjustmentRequired,
    adjustElementCoordinates,
    resizedCoordinates,
    highlightSelectedElement,
    deepCopy,
    generateUUID,
    clearCanvas,
} from "../helper/helper.js";
import PropertiesPanel from "./propertiesPanel.js";
import { MediaDialogWrapper } from "./media_dialg_wrapper";
import { ComponentWrapper } from "@web/legacy/js/owl_compatibility";

export class CanvasDrawer extends Component {
    static template = xml/* xml */ `
        <div class="drawing-area position-relative">
            <canvas id="canvas" t-ref="canvas" t-on-click='onClick' t-on-mousedown="onMouseDown" t-on-mouseup="onMouseUp" t-on-mousemove="onMouseMove">Canvas</canvas>
            <t t-if="shouldShowPropertiesPanel()">
                <PropertiesPanel data.bind="this.setProperties" properties="sidepanelProperties"/>
            </t>
        </div>
    `;

    static components = { PropertiesPanel };

    canvas = useRef("canvas");
    options = useState({
        x1: null,
        y1: null,
        x2: null,
        y2: null,
    });
    resizing = useState({ resizing: false });
    drawing = useState({ drawing: false });
    selectedElement = useState({});
    selectedElementStatus = useState({ isSelected: false });
    sidepanelProperties = useState({
        strokeWidth: 1,
        stroke: "#000000",
        fill: "",
        fillStyle: "solid",
    });
    freehandPath = [];
    lastSelectedElement = useState({});
    writingText = useState({ isWriting: false });

    setProperties(properties) {
        this.sidepanelProperties = deepCopy(properties);
        if (this.selectedElementStatus.isSelected) {
            const elementToUpdate = this.lastSelectedElement;
            if (elementToUpdate) {
                elementToUpdate.addons = {
                    ...elementToUpdate.addons,
                    ...deepCopy(properties),
                };
                this.updateElement(
                    elementToUpdate.id,
                    elementToUpdate.type,
                    elementToUpdate.options,
                    elementToUpdate.addons
                );
                this.drawAllElements();
                highlightSelectedElement(this.canvas, elementToUpdate);
            }
        }
    }

    setup() {
        onMounted(() => {
            this.initializeCanvas();
            this.elements = this.props.canvasElements;
            this.env.elements.push(...this.elements);
            this.drawAllElements();
            this.selectedElement = null;
        });
        useEffect(
            () => {
                this.prepareOffScreenCanvas();
                this.refreshCanvas();
                this.offCanvas();
                this.removeSelection();
                this.resetSidePanel();
            },
            () => [this.props.selectedTool]
        );
        useEffect(
            () => {
                this.selectedElementStatus.isSelected = false;
            },
            () => [this.props.selectedTool === "Selection"]
        );
    }

    resetSidePanel() {
        this.sidepanelProperties.strokeWidth = 1;
        this.sidepanelProperties.stroke = "#000000";
        this.sidepanelProperties.fill = "";
        this.sidepanelProperties.fillStyle = "solid";
    }

    shouldShowPropertiesPanel() {
        const selectedTool = this.props.selectedTool;
        return (
            ["Rect", "Line", "Circle", "Text", "Brush"].includes(selectedTool) ||
            this.selectedElementStatus.isSelected
        );
    }

    initializeCanvas() {
        const container = this.canvas.el.parentElement;
        this.canvas.el.width = container.offsetWidth;
        this.canvas.el.height = window.innerHeight * 0.7;
        this.offCanvas();
    }

    offCanvas() {
        this.offScreenCanvas = document.createElement("canvas");
        this.offScreenCanvas.width = this.canvas.el.width;
        this.offScreenCanvas.height = this.canvas.el.height;
        this.offScreenCanvasCtx = this.offScreenCanvas.getContext("2d");
    }

    createElement(id, type, options, addons = []) {
        const element = {
            id,
            type,
            options,
            addons: deepCopy(addons),
        };
        this.env.elements.push(element);
        this.elements.push(element);
        return element;
    }

    updateElement(id, type, option, addon = []) {
        const element = this.elements.find((el) => el.id === id);
        if (element) {
            element.type = type;
            element.options = option;
            element.addons = deepCopy(addon);
        }
    }

    getMousePos(event) {
        const rect = this.canvas.el.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
        };
    }

    showInputBox(x, y, text = "") {
        this.inputBox = document.createElement("input");
        this.inputBox.type = "text";
        this.inputBox.style.position = "absolute";
        this.inputBox.style.left = `${x}px`;
        this.inputBox.style.top = `${y}px`;
        this.inputBox.style.border = "none";
        this.inputBox.style.outline = "none";
        this.inputBox.style.fontSize = "24px";
        this.inputBox.style.fontFamily = "cursive";
        this.inputBox.value = text;
        const maxWidth = this.canvas.el.width - x;
        this.inputBox.style.width = `${maxWidth}px`;

        this.canvas.el.parentElement.appendChild(this.inputBox);

        this.inputBox.focus();

        this.inputBox.addEventListener("blur", () => {
            const enteredText = this.inputBox.value;
            this.drawAndSaveText(x, y, enteredText);
            this.inputBox.remove();
        });
    }

    drawAndSaveText(x, y, text) {
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

        const id = generateUUID();
        this.currentElement = this.createElement(id, "Text", options, addons);
        this.drawCurrentElement(this.currentElement);
    }

    async drawImage(src) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                const width = img.naturalWidth / 2;
                const height = img.naturalHeight / 2;
                resolve({ width, height });
            };
        });
    }

    onClick(event) {
        if (this.props.selectedTool === "Text") {
            if (!this.writingText.isWriting) {
                const { x, y } = this.getMousePos(event);
                this.showInputBox(x, y);
                this.lastSelectedElement = deepCopy(this.currentElement);
                this.writingText.isWriting = true;
            } else {
                this.writingText.isWriting = false;
                this.selectedElement = null;
            }
        }
    }

    eraseElement(element) {
        this.elements = this.elements.filter((el) => el.id !== element.id);
        const index = this.env.elements.findIndex((el) => el.id === element.id);
        this.env.elements.splice(index, 1);
        this.drawAllElements();
    }

    removeSelection() {
        this.selectedElementStatus.isSelected = false;
        this.selectedElement = null;
        this.drawAllElements();
    }

    async handleImageTool(x, y) {
        const mediaDialogWrapper = new ComponentWrapper(
            document.getSelection().anchorNode.parentElement,
            MediaDialogWrapper,
            {
                noImages: false,
                save: async (media) => {
                    const imgSrc = media.getAttribute("src");
                    const { width, height } = await this.drawImage(imgSrc);
                    const options = {
                        x1: x,
                        y1: y,
                        x2: x + width,
                        y2: y + height,
                    };
                    const addons = { src: imgSrc };
                    const id = generateUUID();
                    const newElement = this.createElement(
                        id,
                        "Image",
                        options,
                        addons
                    );
                    this.drawCurrentElement(newElement);
                },
            }
        );
        return mediaDialogWrapper.mount(document.querySelector("#canvas"));
    }

    handleEraserTool(x, y) {
        const element = getElementAtPosition(x, y, this.elements);
        if (element) {
            this.eraseElement(element);
        }
    }

    handleSelectionTool(event, x, y) {
        const element = getElementAtPosition(x, y, this.elements);
        event.target.style.cursor = element
            ? cursorForPosition(element.position)
            : "default";
        if (!element) {
            this.removeSelection();
            return;
        }

        this.selectedElementStatus.isSelected = true;

        if (element.type === "Brush") {
            const xOffsets = element.options.map((point) => x - point.x);
            const yOffsets = element.options.map((point) => y - point.y);
            this.selectedElement = { ...element, xOffsets, yOffsets };
        } else {
            const offsetX = x - element.options.x1;
            const offsetY = y - element.options.y1;
            this.selectedElement = { ...element, offsetX, offsetY };
            this.selectedElement.position = element.position;
            if (element.position != "inside") {
                this.resizing.resizing = true;
            }
        }
        this.lastSelectedElement = deepCopy(this.selectedElement);
        this.sidepanelProperties = deepCopy(element.addons);
    }

    handleDrawingStart(x, y) {
        this.drawing.drawing = true;
        Object.assign(this.options, { x1: x, y1: y, x2: x, y2: y });
        const id = generateUUID();
        const options = { ...this.options };
        this.currentElement = this.createElement(
            id,
            this.props.selectedTool,
            options,
            this.sidepanelProperties
        );
        this.prepareOffScreenCanvas();
    }

    handleBrushTool(x, y) {
        this.drawing.drawing = true;
        const id = generateUUID();
        const options = this.freehandPath;
        this.currentElement = this.createElement(
            id,
            this.props.selectedTool,
            options,
            this.sidepanelProperties
        );
        this.prepareOffScreenCanvas();
    }

    onMouseDown(event) {
        const { x, y } = this.getMousePos(event);
        const selectedTool = this.props.selectedTool;

        switch (selectedTool) {
            case "Image":
                this.handleImageTool(x, y);
                break;
            case "Eraser":
                this.handleEraserTool(x, y);
                break;
            case "Text":
                break;
            case "Selection":
                this.handleSelectionTool(event, x, y);
                break;
            case "Brush":
                this.freehandPath.push({ x, y });
                this.handleBrushTool(x, y);
                break;
            default:
                this.handleDrawingStart(x, y);
                break;
        }
    }

    onMouseMove(event) {
        const { x, y } = this.getMousePos(event);
        if (this.props.selectedTool === "Selection") {
            const element = getElementAtPosition(x, y, this.elements);
            event.target.style.cursor = element
                ? cursorForPosition(element.position)
                : "default";
            if (this.selectedElement) {
                if (this.resizing.resizing) {
                    this.resizeElement(x, y, this.selectedElement);
                } else {
                    this.moveSelectedElement(x, y, this.selectedElement);
                }
                const copyElement = this.elements.find(
                    (el) => el.id === this.selectedElement.id
                );
                this.lastSelectedElement = deepCopy(copyElement);
                return;
            }
        }
        if (!this.drawing.drawing) return;
        if (this.props.selectedTool === "Brush") {
            this.freehandPath.push({ x, y });
            Object.assign(this.currentElement.options, this.freehandPath);
            this.drawCurrentElement(this.currentElement);
            return;
        }
        Object.assign(this.options, { x2: x, y2: y });
        Object.assign(this.currentElement.options, this.options);
        clearCanvas(this.canvas);
        this.refreshCanvas();
        this.drawCurrentElement(this.currentElement);
    }

    onMouseUp(event) {
        if (
            this.props.selectedTool === "Image" ||
            this.props.selectedTool === "Text"
        )
            return;
        this.drawing.drawing = false;
        this.resizing.resizing = false;
        const { x, y } = this.getMousePos(event);
        if (this.props.selectedTool === "Brush") {
            this.freehandPath = [];
            console.log(this.elements);
            return;
        }
        if (this.currentElement) {
            if (adjustmentRequired(this.currentElement.type)) {
                const option = adjustElementCoordinates(this.currentElement);
                this.updateElement(
                    this.currentElement.id,
                    this.currentElement.type,
                    option,
                    this.currentElement.addons
                );
            }
        }
        console.log(this.elements);
        this.selectedElement = null;
    }

    resizeElement(x, y, element) {
        const option = resizedCoordinates(
            x,
            y,
            element.position,
            element.options
        );
        this.updateElement(element.id, element.type, option, element.addons);
        this.drawAllElements();
    }

    moveSelectedElement(x, y, element) {
        let newOptions;
        if (element.type === "Brush") {
            newOptions = this.selectedElement.options.map((_, index) => ({
                x: x - this.selectedElement.xOffsets[index],
                y: y - this.selectedElement.yOffsets[index],
            }));
            const elementsCopy = [...this.elements];
            elementsCopy[this.selectedElement.id] = {
                ...elementsCopy[this.selectedElement.id],
                options: newOptions,
            };
        } else {
            const { x1, y1, x2, y2 } = element.options;
            const { offsetX, offsetY } = element;
            const width = x2 - x1;
            const height = y2 - y1;
            const newX1 = x - offsetX;
            const newY1 = y - offsetY;
            newOptions = {
                x1: newX1,
                y1: newY1,
                x2: newX1 + width,
                y2: newY1 + height,
            };
        }
        this.updateElement(
            element.id,
            element.type,
            newOptions,
            element.addons
        );
        this.drawAllElements();
    }

    async drawAllElements() {
        if (!this.elements || !Array.isArray(this.elements)) {
            return;
        }
        clearCanvas(this.canvas);
        for (const element of this.elements) {
            await this.drawCurrentElement(element);
            if (
                this.selectedElement &&
                this.selectedElement.id === element.id
            ) {
                highlightSelectedElement(this.canvas, element);
            }
        }
    }

    prepareOffScreenCanvas() {
        this.offScreenCanvas.getContext("2d").drawImage(this.canvas.el, 0, 0);
    }

    async drawCurrentElement(element) {
        this.currentDrawer = new ShapeDrawer(this.canvas.el);
        await this.currentDrawer.drawShape(
            element.type,
            element.options,
            element.addons || {}
        );
    }

    refreshCanvas() {
        const ctx = this.canvas.el.getContext("2d");
        ctx.drawImage(this.offScreenCanvas, 0, 0);
    }
}
