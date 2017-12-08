odoo.define('hr_expense.FormRenderer', function (require) {
"use static";

var core = require('web.core');
var FormRenderer = require('web.FormRenderer');
var AttachDocument = require('hr_expense.Attachment');

FormRenderer.include({
    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    /**
     * The method will be automatically called to replace the button with widget <AttachDocument>.
     * @private
     */
     _renderButtonWidget: function (node, state) {
         //  get widget into registry
         var Widget = core.button_widgets_registry.get(node.attrs.widget);
         if (!Widget) {
             console.warn("Missing widget: ", node.attrs.widget, " for button", node.attrs.name);
             return ;
         }
         // Initialize the widget
         var widget = new Widget(this, {node: node, state: state});
         widget.appendTo($('<span>'));
         return widget.$el;
     },

     /**
      * @override
      * @private
      * @param {Object} node
      * @returns {jQueryElement}
      */
     _renderHeaderButton: function (node) {
         if (node.attrs.widget) {
            var $button = this._renderButtonWidget(node, this.state);
            debugger
            if ($button && $button.length){
                this._handleAttributes($button, node);
                this._registerModifiers(node, this.state, $button);
                return $button;
            }
         }
        return this._super.apply(this, arguments);
     },
});
});
