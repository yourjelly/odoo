(function () {
'use strict';

var pluginsRegistry = we3.pluginsRegistry = {};
function whiteList (pluginName) {
    return [ 'Arch', 'Range', 'Renderer', 'Rules', 'BaseArch', 'BaseRange', 'BaseRenderer', 'BaseRules'].indexOf(pluginName) !== -1;
}
function isBase (pluginName) {
    return ['BaseArch', 'BaseRange', 'BaseRenderer', 'BaseRules'].indexOf(pluginName) !== -1;
}

we3.PluginsManager = class extends we3.EventDispatcher {
    /**
     * The plugin can call insertBeforeEditable and insertAfterEditable to add content
     * in the dom.
     * Before all plugins are started, the plugins can't have access to the DOM.
     *
     */
    constructor (parent, params, options) {
        super(parent);
        this.options = options || {};
        this.editor = params.editor;
        delete params.editor;
        params.plugins.BaseArch = true;
        params.plugins.BaseRange = true;
        params.plugins.BaseRenderer = true;
        params.plugins.BaseRules = true;
        params.plugins.Arch = true;
        params.plugins.Range = true;
        params.plugins.Rules = true;
        this._promiseLoadPlugins = this._loadPlugins(params, options);
    }
    /**
     * return a Promise resolved when the plugin is initialized and can be started
     * This method can't start new call or perform calculations, must just return
     * the deferreds created in the init method.
     *
     * @returns {Promise}
     */
    isInitialized () {
        return Promise.all([this._promiseLoadPlugins, this._eachAsyncParallel('isInitialized')]);
    }
    /**
     * Start all plugins when all plugins are initialized and the editor and plugins
     * are inserted into the deepest container.
     * When all plugin are starte, the DOM references are added to all plugins
     *
     * @returns {Promise}
     */
    start () {
        return this._eachAsyncParallel('start').then(this._afterStartAddDomTools.bind(this));
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    call (pluginName, methodName, args) {
        var plugin = this._plugins[pluginName];
        if (plugin) {
            return plugin[methodName].apply(plugin, args);
        }
    }

    /**
     * The following methods call methods of the same name in `AbstractPlugin`, which in turn
     * can be overridden from within any plugin to allow it to add specific behavior to any of
     * these basic actions on the editor (eg modifying the value to save, then passing it to
     * the next plugin's saveEditor override etc.).
     */

    /**
     *
     * Note: This method must be idempotent.
     *
     * @param {string} value
     * @returns string
     */
    getEditorValue (value, options) {
        this._each('getEditorValue');
        return this._plugins.Arch.getValue(options);
    }
    /**
     *
     * @param {string} value
     * @returns string
     */
    setEditorValue (value) {
        this._each('setEditorValue', value);
    }
    /**
     *
     * @param {string} value
     */
    changeEditorValue () {
        this._each('changeEditorValue');
    }
    /**
     * Note: Please only change the string value without using the DOM.
     * The value is received from getEditorValue.
     *
     * @param {string} value
     * @returns {Promise<string>}
     */
    saveEditor () {
        var Arch = this._plugins.Arch;
        return this._eachAsync('saveEditor').then(function () {
            return Arch.getValue();
        });
    }
    /**
     * 
     * @returns {Promise}
     */
    cancelEditor () {
        return this._eachAsync('cancelEditor');
    }
    /**
     *
     * @param {string} pluginName
     * @param {string} string
     * @param {string} originalValue
     * @param {Node} elem
     * @param {string} attributeName
     * @returns string|null
     */
    translatePluginString (pluginName, string, originalValue, elem, attributeName) {
        for (var i = 0; i < this._pluginNames.length; i++) {
            var plugin = this._plugins[this._pluginNames[i]];
            string = plugin.translatePluginTerm(pluginName, string, originalValue, elem, attributeName);
        }
        return string;
    }
    /**
     *
     */
    blurEditor () {
        this._each('blurEditor');
    }
    /**
     *
     */
    focusEditor () {
        this._each('focusEditor');
    }

    //--------------------------------------------------------------------------
    // Private
    //--------------------------------------------------------------------------

    _afterStartAddDomTools () {
        var obj = {};
        var Arch = this._plugins.Arch;
        for (var k in Arch) {
            if (k[0] !== '_' && !this[k] && typeof Arch[k] === 'function') {
                obj[k] = Arch[k] = Arch[k].bind(Arch);
            }
        }
        var options = Object.assign(obj, this.options);
        this._each('_afterStartAddDomReferences', this.editor);
    }
    _each (methodName, value) {
        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var plugin = this._plugins[pluginName];
            value = plugin[methodName](value) || value;
        }
        return value;
    }
    _eachAsync (methodName, value) {
        var promise = Promise.resolve(value);
        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var plugin = this._plugins[pluginName];
            promise.then(plugin[methodName].bind(plugin));
        }
        return promise;
    }
    _eachAsyncParallel (methodName, value) {
        var promises = [];
        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var plugin = this._plugins[pluginName];
            promises.push(plugin[methodName](value));
        }
        return Promise.all(promises);
    }
    _loadPlugins (params, options) {
        var self = this;
        this._plugins = this._createPluginInstance(params, options);
        this._pluginNames = this._getSortedPluginNames(this._plugins);
        var promises = [this._loadTemplatesDependencies(this._pluginNames, this._plugins, options)];

        for (var i = 0; i < this._pluginNames.length; i++) {
            var pluginName = this._pluginNames[i];
            var pluginInstance = this._plugins[pluginName];
            var dependencies = {};
            for (var k = 0; k < pluginInstance.dependencies.length; k++) {
                var depName = pluginInstance.dependencies[k];
                if (whiteList(pluginName) || !isBase(depName)) {
                    dependencies[depName] = this._plugins[depName];
                } else {
                    throw new Error("Non-base plugin '" + pluginName +
                        "' is trying to access base plugin '" + depName +
                        "'. I won't let you.\n" +
                        "Signed: Your Father, Luke.");
                }
            }
            pluginInstance.dependencies = Object.freeze(dependencies);
            promises.push(pluginInstance.isInitialized());
        }

        return Promise.all(promises).then(function () {
            Object.freeze(self._plugins);
        });
    }
    _getPluginConstructor (params, pluginName) {
        var Plugin = typeof Plugin !== 'function' ? pluginsRegistry[pluginName] : params.plugins[pluginName];
        if (!Plugin) {
            throw new Error("The plugin '" + pluginName + "' is unknown or couldn't be loaded.");
        }
        return Plugin;
    }
    /*
     * sort with the deepest dependencies in first
     */
    _getSortedPluginNames (pluginInstances) {
        var pluginNames = Object.keys(pluginInstances);
        function deepestPluginsDependent(pluginNames, deep) {
            deep += 1;
            for (var i = 0; i < pluginNames.length; i++) {
                var pluginInstance = pluginInstances[pluginNames[i]];
                if (deep > pluginInstance._deepestPluginsDependent) {
                    pluginInstance._deepestPluginsDependent = deep;
                }
                deepestPluginsDependent(pluginInstance.dependencies);
            }
        }
        deepestPluginsDependent(pluginInstances);
        pluginNames.sort(function (a, b) {
            return pluginInstances[b]._deepestPluginsDependent - pluginInstances[a]._deepestPluginsDependent;
        });
        for (var i = 0; i < pluginNames.length; i++) {
            delete pluginInstances[pluginNames[i]]._deepestPluginsDependent;
        }
        pluginNames.splice(pluginNames.indexOf('Arch'), 1);
        pluginNames.unshift('Arch');
        return pluginNames;
    }
    _createPluginInstance (params, options) {
        var pluginNames = [];

        Object.keys(params.plugins).forEach(function (pluginName) {
            if (params.plugins[pluginName]) {
                pluginNames.push(pluginName);
            }
        });

        var conflictsPlugins = [];
        var autoInstallPlugins = [];
        Object.keys(pluginsRegistry).forEach(function (pluginName) {
            var Plugin = pluginsRegistry[pluginName];
            if (Plugin.autoInstall && pluginNames.indexOf(pluginName) === -1 && params.plugins[pluginName] !== false) {
                autoInstallPlugins.push({
                    name: pluginName,
                    need: Plugin.autoInstall.slice(),
                });
            }
            if (Plugin.conflicts) {
                conflictsPlugins.push(Plugin.conflicts.concat([pluginName]));
            }
        });

        this.target = params.target;

        var pluginInstances = {};
        while (pluginNames.length) {
            this._createPluginInstanceLoadDependencies(params, options, pluginInstances, pluginNames, autoInstallPlugins);
            this._createPluginInstanceAutoInstall(params, options, pluginInstances, pluginNames, autoInstallPlugins, conflictsPlugins);
        }
        return pluginInstances;
    }
    _createPluginInstanceLoadDependencies (params, options, pluginInstances, pluginNames, autoInstallPlugins) {
        var pluginName;
        while (pluginName = pluginNames.shift()) {
            var Plugin = this._getPluginConstructor(params, pluginName);
            if (!Plugin) {
                throw new Error('Plugin not found: "' + pluginName + '"');
            }
            var pluginInstance = new Plugin(this, params, options);
            pluginInstance.pluginName = pluginName;

            // add dependencies

            for (var k = 0; k < pluginInstance.dependencies.length; k++) {
                var pName = pluginInstance.dependencies[k];
                if (pluginNames.indexOf(pName) === -1 && !pluginInstances[pluginName]) {
                    pluginNames.push(pName);
                }
            }
            pluginInstances[pluginName] = pluginInstance;

            // add autoInstall plugins

            for (var k = 0; k < autoInstallPlugins.length; k++) {
                var autoInstall = autoInstallPlugins[k];
                var index;
                while ((index = autoInstall.need.indexOf(pluginName)) !== -1) {
                    autoInstall.need.splice(index, 1);
                }
            }
        }
    }
    _createPluginInstanceAutoInstall (params, options, pluginInstances, pluginNames, autoInstallPlugins, conflictsPlugins) {
        autoInstallloop:
        for (var k = autoInstallPlugins.length - 1; k >= 0 ; k--) {
            var autoInstall = autoInstallPlugins[k];
            var pluginName = autoInstall.name;

            if (autoInstall.need.length) {
                continue;
            }

            autoInstallPlugins.splice(k, 1);

            if (pluginNames.indexOf(pluginName) !== -1 || pluginInstances[pluginName]) {
                continue;
            }

            for (var i = 0; i < conflictsPlugins.length; i++) {
                var list = conflictsPlugins[i];
                if (list.indexOf(pluginName) === -1) {
                    continue;
                }
                for (var u = 0; u < list.length; u++) {
                    if (!pluginInstances[list[u]]) {
                        continue;
                    }
                    continue autoInstallloop;
                }
            }

            pluginNames.push(pluginName);
        }
    }
    _loadTemplatesDependencies (pluginNames, pluginInstances, options) {
        var templatesDependencies = [];
        for (var i = 0; i < pluginNames.length; i++) {
            var pluginInstance = pluginInstances[pluginNames[i]];
            for (var k = 0; k < pluginInstance.templatesDependencies.length; k++) {
                var src = pluginInstance.templatesDependencies[k];
                if (templatesDependencies.indexOf(src) === -1) {
                    templatesDependencies.push(src);
                }
            }
        }
        return options.loadTemplates(templatesDependencies);
    }
};

we3.addPlugin = function (pluginName, Plugin) {
    if (whiteList(pluginName)) {
        throw new Error("Trying to overwritten base plugin '" + pluginName +
            "'. I won't let you, learn your lesson.\n" +
            "Signed: Obi-Wan.");
    }
    if (pluginsRegistry[pluginName]) {
        console.info('The wysiwyg "' + pluginName + '" plugin was overwritten');
    }
    pluginsRegistry[pluginName] = Plugin;
    return this;
};
we3.getPlugin = function (pluginName) {
    if (whiteList(pluginName)) {
        throw new Error("Trying to acces base plugin '" + pluginName +
            "'. I won't let you, learn your lesson.\n" +
            "Signed: Obi-Wan.");
    }
    return pluginsRegistry[pluginName];
};



})();
