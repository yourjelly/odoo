/** @odoo-module **/

class ShapeDrawer {
    constructor(canvas) {
        this.rc = rough.canvas(canvas);
    }

    async drawShape(toolName, options = {}, addons = {}) {
        const generator = rough.generator();
        let roughElement;
        let x1, x2, y1, y2, width, height, ctx;
        const drawingOptions = { roughness: 0, ...addons };
        switch (toolName) {
            case "Line":
                roughElement = generator.line(
                    options.x1,
                    options.y1,
                    options.x2,
                    options.y2,
                    drawingOptions
                );
                this.rc.draw(roughElement);
                break;
            case "Rect":
                [x1, x2] = [options.x1, options.x2].sort((a, b) => a - b);
                [y1, y2] = [options.y1, options.y2].sort((a, b) => a - b);
                width = x2 - x1;
                height = y2 - y1;

                roughElement = generator.rectangle(
                    x1,
                    y1,
                    width,
                    height,
                    drawingOptions
                );
                this.rc.draw(roughElement);
                break;
            case "Circle":
                ({ x1, y1, x2, y2 } = options);
                width = x2 - x1;
                height = y2 - y1;

                roughElement = generator.ellipse(
                    x1 + width / 2,
                    y1 + height / 2,
                    width,
                    height,
                    drawingOptions
                );
                this.rc.draw(roughElement);
                break;
            case "Text":
                ctx = this.rc.ctx;
                ctx.textBaseline = "top";
                ctx.font = "24px cursive";
                ctx.fillStyle = addons.fill || "#000000";
                ctx.fillText(addons.text, options.x1, options.y1);
                break;
            case "Image":
                ({ x1, y1, x2, y2 } = options);
                width = x2 - x1;
                height = y2 - y1;
                const img = new Image();
                img.src = addons.src;
                ctx = this.rc.ctx;
                await new Promise((resolve) => {
                    img.onload = () => {
                        ctx.drawImage(img, x1, y1, width, height);
                        resolve();
                    };
                });
                break;
            case "Brush":
                this.rc.ctx.lineWidth = addons.strokeWidth;
                this.rc.ctx.strokeStyle = addons.stroke;
                this.rc.ctx.beginPath();
                for (let i = 0; i < options.length - 1; i++) {
                    const point1 = options[i];
                    const point2 = options[i + 1];
                    this.rc.ctx.moveTo(point1.x, point1.y);
                    this.rc.ctx.lineTo(point2.x, point2.y);
                }
                this.rc.ctx.stroke();
                break;
        }
    }
}

export default ShapeDrawer;
