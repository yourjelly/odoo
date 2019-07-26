(function () {
'use strict';

var regMultiSpace = /\s\s+/g;
var regSplitStyles = /\s*;\s*/;
var regSplitStyle = /\s*:\s*/;

//////////////////////////////////////////////////////////////

var ClassName = class {
    constructor (archNode, classNames) {
        this.archNode = archNode;
        if (!classNames) {
            classNames = '';
        }
        if (classNames instanceof ClassName) {
            this.value = classNames.value.slice();
        } else {
            this.value = classNames.trim().length ? classNames.replace(regMultiSpace, ' ').split(' ') : [];
        }
    }
    get length () {
        return this.toString().length;
    }
    /**
     * Return the classes as a space-separated string.
     *
     * @returns {string}
     */
    toString () {
        return this.value.sort().join(' ');
    }

    /**
     * Add class(es).
     *
     * @param {string} classNames
     */
    add (classNames) {
        if (!this.archNode.isAllowUpdate()) {
            console.warn("cannot update class of a non editable node");
            return;
        }
        var self = this;
        classNames.replace(regMultiSpace, ' ').split(' ').forEach(function (className) {
            var index = self.value.indexOf(className);
            if (index === -1) {
                self.value.push(className);
                self.archNode._triggerChange(null);
            }
        });
    }
    /**
     * Return true if `className` is contained in the classes.
     *
     * @param {string} className
     * @returns {Boolean}
     */
    contains (className) {
        return this.value.indexOf(className) !== -1;
    }
    /**
     * Return true if this ClassName object is equal to the given ClassName object.
     *
     * @param {ClassName} [obj]
     * @param {Object} [options]
     * @returns {Boolean}
     */
    isEqual (obj, options) {
        if (!obj) {
            return !this.value.length;
        }
        var self = this;
        var isEqual = true;
        this.value.concat(obj.value).forEach(function (className) {
            if (!isEqual || options && options.blackListClassNames && options.blackListClassNames.indexOf(className) !== -1) {
                return;
            }
            if (self.value.indexOf(className) === -1 || obj.value.indexOf(className) === -1) {
                isEqual = false;
            }
        });
        return isEqual;
    }
    /**
     * Remove the given class(es).
     *
     * @param {string} classNames
     */
    remove (classNames) {
        if (!this.archNode.isAllowUpdate()) {
            console.warn("cannot update class of a non editable node");
            return;
        }
        var self = this;
        classNames.replace(regMultiSpace, ' ').split(' ').forEach(function (className) {
            var index = self.value.indexOf(className);
            if (index !== -1) {
                self.value.splice(index, 1);
                self.archNode._triggerChange(null);
            }
        });
    }
    /**
     * Toggle a class.
     *
     * @param {string} className
     */
    toggle (className) {
        if (this.contains(className)) {
            this.remove(className);
        } else {
            this.add(className);
        }
    }
};

//////////////////////////////////////////////////////////////

var Attributes = we3.Attributes = class {
    constructor (archNode, attributes) {
        var self = this;
        this.archNode = archNode;
        this.__order__ = [];
        if (attributes instanceof Attributes) {
            this.__order__ = attributes.__order__.map(function (name) {
                var value = attributes[name];
                if (name === 'class') {
                    value = new ClassName(archNode, value);
                } else if (name === 'style') {
                    value = new Style(archNode, value);
                }
                self[name] = value;
                return name;
            });
        } else {
            attributes.forEach(function (attribute) {
                self.add(attribute[0], attribute[1]);
            });
        }
    }
    add (name, value) {
        if ((name !== 'class' && name !== 'style' || value !== '') && !this.archNode.isAllowUpdate()) {
            console.warn("cannot update style of a non editable node");
            return;
        }
        if (this.__order__.indexOf(name) === -1) {
            this.__order__.push(name);
        }
        if (name === 'class') {
            if (this.class && this.class.toString() === value + '') {
                return;
            }
            value = new ClassName(this.archNode, value);
        } else if (name === 'style') {
            if (this.style && this.style.toString() === value + '') {
                return;
            }
            value = new Style(this.archNode, value);
        } else if (value === null || value === '') {
            return this.remove(name);
        }
        if (this[name] + '' !== value + '') {
            this[name] = value;
            this.archNode._triggerChange(null);
        }
    }
    clear () {
        if (!this.archNode.isAllowUpdate()) {
            console.warn("cannot update attribute of a non editable node");
            return;
        }
        var self = this;
        this.__order__.forEach(function (name) {
            delete self[name];
        });
        this.__order__ = [];
    }
    isEqual (obj, options) {
        if (!obj) {
            return !this.__order__.length;
        }
        var self = this;
        var isEqual = true;
        var list = this.__order__.slice();
        obj.__order__.forEach(function (name) {
            if (list.indexOf(name) === -1) {
                list.push(name);
            }
        });
        list.forEach(function (name) {
            if (!name.indexOf('_') || !isEqual || options && options.blackList && options.blackList.indexOf(name) !== -1) {
                return;
            }
            if (name === 'class' || name === 'style') {
                isEqual = self[name].isEqual(obj[name], options);
            } else if (self[name] instanceof Array && obj[name] instanceof Array) {
                isEqual = self[name].every(function (item, index) {
                    return obj[name][index] && item === obj[name][index];
                });
            } else if (self[name] !== obj[name]) {
                isEqual = false;
            }
        });
        return isEqual;
    }
    forEach (fn) {
        this.__order__.forEach(fn.bind(this));
    }
    remove (name) {
        if (!this.archNode.isAllowUpdate()) {
            console.warn("cannot update attribute of a non editable node");
            return;
        }
        var index = this.__order__.indexOf(name);
        if (index !== -1) {
            this.__order__.splice(index, 1);
            this.archNode._triggerChange(null);
        }
        delete this[name];
    }
    set (name, value) {
        this.add(name, value);
    }
    toJSON () {
        var self = this;
        var attributes = [];
        this.__order__.forEach(function (name) {
            var value = name in self ? self[name].toString() : '';
            if (value.length) {
                attributes.push([name, value]);
            }
        });
        return attributes;
    }
    toString () {
        var self = this;
        var string = '';
        this.__order__.forEach(function (name) {
            var value = name in self ? self[name].toString() : '';
            if (!value.length) {
                return;
            }
            if (string.length) {
                string += ' ';
            }
            string += name + '="' + value.replace('"', '\\"') + '"';
        });
        return string;
    }
};

//////////////////////////////////////////////////////////////

var Style = class extends Attributes {
    constructor (archNode, style) {
        if (!style) {
            style = '';
        }
        if (style instanceof Style) {
            super(archNode, style);
        } else {
            super(archNode, []);
            var self = this;
            style.trim().split(regSplitStyles).forEach(function (style) {
                var split = style.split(regSplitStyle);
                if (split.length === 2) {
                    self.add(split[0], split[1]);
                }
            });
        }
    }
    add (name, value) {
        if (!this.archNode.isAllowUpdate()) {
            console.warn("cannot update style of a non editable node");
            return;
        }
        if (value.trim() === '') {
            return this.remove(name);
        }
        if (this.__order__.indexOf(name) === -1) {
            this.__order__.push(name);
        }
        if (this[name] !== value) {
            this[name] = value;
            this.archNode._triggerChange(null);
        }
    }
    get length () {
        return this.__order__.length;
    }
    update (style) {
        var self = this;
        Object.keys(style).forEach (function (key) {
            self.add(key, style[key]);
        });
    }
    toString () {
        var self = this;
        var string = '';
        this.__order__.forEach(function (name) {
            var value = self[name].toString();
            if (!value.length) {
                return;
            }
            if (string.length) {
                string += '; ';
            }
            string += name + ':' + value.replace('"', '\\"');
        });
        return string;
    }
};

})();
