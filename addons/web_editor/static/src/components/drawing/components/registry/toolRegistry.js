/** @odoo-module **/

class ToolRegistry {
        constructor() {
            this.tools = {};
        }
    
        add(name, icon, component) {
            this.tools[name] = { icon, component };
        }
    
        getTool(name) {
            return this.tools[name]?.component;
        }
    
        getAll() {
            return Object.entries(this.tools).map(([name, { icon }]) => ({
                name,
                icon,
            }));
        }
    }
    
    // Create a global instance of the registry
    const toolRegistry = new ToolRegistry();
    
    toolRegistry.add("Selection", "fa fa-mouse-pointer");
    toolRegistry.add("Line", "fa fa-navicon");
    toolRegistry.add("Rect", "fa fa-square");
    toolRegistry.add("Circle", "fa fa-circle");
    toolRegistry.add("Text", "fa fa-font");
    toolRegistry.add("Eraser", "fa fa-eraser");
    toolRegistry.add("Image", "fa fa-image");
    toolRegistry.add("Brush", "fa fa-paint-brush");
    
export default toolRegistry;