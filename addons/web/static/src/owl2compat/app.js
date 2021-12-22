(function () {
    const App = owl.App;

    const compiledTemplates = {};

    owl.App = class extends App {
        constructor() {
            super(...arguments);
            this.templates = compiledTemplates;
        }
    };
})();
