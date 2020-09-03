odoo.define("poc.arch_parser", function () {

    class ArchNode {
        constructor(tag, attributes, children) {
            this.tag = tag.toLowerCase();
            this.attrs = attributes;
            this.children = children;
        }

        has(name) {
            return this.attrs.hasOwnProperty(name);
        }
        get(name) {
            const value = this.attrs[name];
            const exists = this.has(name);

            return {
                get exists() {
                    return exists;
                },
                get isNull() {
                    return !this.exists || value === null;
                },
                get isNotNull() {
                    return !this.isNull;
                },
                get raw() {
                    return value;
                },
                get boolean() {
                    return this.isNotNull && (value.toLowerCase() === "true" || value === "1");
                },
                get number() {
                    return this.isNotNull ? parseFloat(value) : null;
                },
                get json() {
                    return this.isNotNull ? JSON.parse(value) : null;
                },
                get pyEval() {
                    return this.isNotNull ? py.eval(value) : false;
                },
                list(separator) {
                    return this.isNotNull ? value.split(separator) : [];
                },
            };
        }
    }

    function parseArch(arch) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(arch, "text/xml").documentElement;
        const stripWhitespaces = doc.nodeName.toLowerCase() !== "kanban";

        function xmlToJson(node) {
            switch (node.nodeType) {
                case 9:
                    return xmlToJson(node.documentElement);
                case 3:
                case 4:
                    return (stripWhitespaces && node.data.trim() === "") ? undefined : node.data;
                case 1: {
                    const attributes = Object.fromEntries(
                        Array.from(node.attributes).map(x => [x.name, x.value])
                    );
                    const children = Array.from(node.childNodes)
                        .map(node => xmlToJson(node))
                        .filter((obj) => typeof obj === "object" && obj !== null);
                    return new ArchNode(
                        node.tagName.toLowerCase(),
                        attributes,
                        children
                    );
                }
            }
        }

        return xmlToJson(doc);
    }

    return parseArch;
});
