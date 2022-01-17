(function () {
    const App = owl.App;

    // tmeplates' code is shared between multiple instances of Apps
    // This is useful primarly for the OWL2 to Legacy compatibility layer
    // It is also useful for tests.
    // The downside of this is that the compilation is done once with the compiling app's
    // translate function and attributes.
    const sharedTemplates = {};

    owl.App = class extends App {
        constructor() {
            super(...arguments);
            this.setup();
        }
        _compileTemplate(name) {
            if (!(name in sharedTemplates)) {
                sharedTemplates[name] = super._compileTemplate(...arguments);
            }
            return sharedTemplates[name];
        }
        setup() {}
    };

    owl.App.sharedTemplates = sharedTemplates;
})();
