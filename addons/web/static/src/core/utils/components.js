/** @odoo-module **/

const { Component, onError, useComponent, xml } = owl;

export class ErrorHandler extends Component {
    setup() {
        onError((error) => {
            if (this.props.onError) {
                this.props.onError(error);
            }
        });
    }
}
ErrorHandler.template = xml`<t t-slot="default" />`;
