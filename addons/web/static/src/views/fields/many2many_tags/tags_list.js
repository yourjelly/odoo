/** @odoo-module **/

const { Component, markup } = owl;

export class TagsList extends Component {
    get visibleTags() {
        console.log(this.props);
        if (this.props.itemsVisible && this.props.tags.length > this.props.itemsVisible) {
            return this.props.tags.slice(0, this.props.itemsVisible - 1);
        }
        return this.props.tags;
    }
    get otherTags() {
        if (!this.props.itemsVisible || this.props.tags.length <= this.props.itemsVisible) {
            return [];
        }
        return this.props.tags.slice(this.props.itemsVisible - 1);
    }
    get tooltip() {
        return markup(this.otherTags.map((i) => i.text).join("<br/>"));
    }
}
TagsList.template = "web.TagsList";
TagsList.defaultProps = {
    displayBadge: true,
};
TagsList.props = {
    displayBadge: { type: Boolean, optional: true },
    name: { type: String, optional: true },
    itemsVisible: { type: Number, optional: true },
    tags: { type: Object, optional: true },
};
