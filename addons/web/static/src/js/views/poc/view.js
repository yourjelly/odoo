odoo.define("poc.view", function (require) {
    "use strict";

    const {
        Component,
        tags: {
            xml,
        },
    } = owl;

    class View extends Component {
    }
    View.template = xml/*xml*/`
    <div>View</div>
    `;

    return View;
});
