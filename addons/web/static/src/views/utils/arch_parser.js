/** @odoo-module **/

export class ArchParser {
    /**
     * to override. Should return the parsed content of the arch.
     * It can call the visitArch function if desired
     */
    parse() {}

    visitArch(arch, callback) {
        function visit(xml) {
            if (xml) {
                callback(xml);
                for (let child of xml.children) {
                    visit(child);
                }
            }
        }
        const xmlDoc = typeof arch === "string" ? this.parseXML(arch) : arch;
        visit(xmlDoc);
    }

    parseXML(arch) {
        const parser = new DOMParser();
        const xml = parser.parseFromString(arch, "text/xml");
        return xml.documentElement;
    }
}
