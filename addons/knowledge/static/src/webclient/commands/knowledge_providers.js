/** @odoo-module */


import { _lt } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";

const { Component } = owl;
const { xml } = owl.tags;

class KnowledgeCommand extends Component {}
// TODO: highlight the search term
KnowledgeCommand.template = xml`
    <div class="o_command_left">
        <icon t-att-class="props.icon_string"/>
        <span t-esc="props.name"/>
        <icon t-if="props.isFavourite" class="fa fa-star" />
        <span t-if="props.parentName" t-esc="'— '" class="text-muted small" />
        <span t-if="props.parentName" t-esc="props.parentName" class="text-muted small" />
    </div>
`;
// TODO: redirect to knowledge form view with search
var headerTemplate = xml`<a href="#">
    <span>Advanced Search</span>
    <icon class="fa fa-expand" />
</a>`;
const headerTemplateRegistry = registry.category("command_header_template");
headerTemplateRegistry.add("?", headerTemplate);
const footerRegistry = registry.category("palette_footer");
footerRegistry.add("?", "articles");

const commandEmptyMessageRegistry = registry.category("command_empty_list");
// TODO: show "Create one for [query]" if the user has the right to create a new article
commandEmptyMessageRegistry.add("?", _lt("No article found."));

const commandProviderRegistry = registry.category("command_provider");
commandProviderRegistry.add("knowledge", {
    namespace: "?",
    async provide(newEnv, options) {
        const domain = ["|",
            ["name", "ilike", options.searchValue],
            ["parent_id.name", "ilike", options.searchValue],
        ];
        const fields = ['name', 'is_user_favourite', 'parent_id', 'icon_string'];
        const limit = 10;
        const articlesData = await Component.env.services.rpc({
            model: "knowledge.article",
            method: "search_read",
            kwargs: {
                domain,
                fields,
                limit,
            },
        });
        return articlesData.map((article) => ({
            Component: KnowledgeCommand,
            action() {
                // TODO: when the user clicks on the command, open the article
                // waiting for view/route to be completed...
                browser.location.href = "/knowledge/article/" + article.id;
            },
            name: article.name,
            props: {
                isFavourite: article.is_user_favourite,
                parentName: article.parent_id[1],
                icon_string: article.icon_string,
                // TODO: is there a better way to do this? Fix this mess
                // beforeNameMatch: article.name.slice(0, article.name.indexOf(options.searchValue)),
                // nameMatch: article.name.slice(article.name.indexOf(options.searchValue), options.searchValue.length),
                // postNameMatch: article.name.slice(article.name.indexOf(options.searchValue) + options.searchValue.length),
            },
        }));
    },
});
