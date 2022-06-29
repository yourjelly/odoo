/** @odoo-module **/
import { KanbanCompiler } from "@web/views/kanban/kanban_compiler";

function compileTemplate(arch) {
    const parser = new DOMParser();
    const xml = parser.parseFromString(arch, "text/xml");
    const compiler = new KanbanCompiler();
    return compiler.compile(xml.documentElement).outerHTML;
}

function areEquivalent(assert, template1, template2) {
    if (template1.replace(/\s/g, "") === template2.replace(/\s/g, "")) {
        assert.ok(true);
    } else {
        assert.strictEqual(template1, template2);
    }
}

QUnit.module("Kanban Compiler", () => {
    QUnit.test("simple test", async (assert) => {
        const arch = `
            <kanban class="o_kanban_test">
                <templates><t t-name="kanban-box">
                    <div>
                        <t t-esc="record.foo.value"/>
                        <field name="foo"/>
                    </div>
                </t></templates>
            </kanban>`;
        const expected = `
            <t><kanban class="o_kanban_test">
                <templates><t>
                    <div t-att-tabindex="props.record.model.useSampleModel?-1:0" role="article" t-att-data-id="props.canResequence and props.record.id" t-on-click="onGlobalClick" t-att-class="getRecordClasses()">
                        <t t-esc="record.foo.value"/><span t-esc="record[&quot;foo&quot;].value"/>
                    </div>
                </t></templates>
            </kanban></t>
        `;

        areEquivalent(assert, compileTemplate(arch), expected);
    });

    QUnit.test("advanced test", async (assert) => {
        const arch = `
            <kanban default_group_by="stage_id" class="o_utm_kanban" on_create="quick_create" quick_create_view="utm.utm_campaign_view_form_quick_create" examples="utm_campaign" sample="1">
                <field name="color" modifiers="{}"/>
                <field name="stage_id" can_create="true" can_write="true" modifiers="{&quot;required&quot;: true}"/>
                <templates>
                    <t t-name="kanban-box">
                        <div t-attf-class="oe_kanban_color_#{kanban_getcolor(record.color.raw_value)} oe_kanban_card oe_kanban_global_click">
                            <div class="o_dropdown_kanban dropdown">
                                <a role="button" class="dropdown-toggle o-no-caret btn" data-toggle="dropdown" href="#" aria-label="Dropdown menu" title="Dropdown menu">
                                    <span class="fa fa-ellipsis-v"/>
                                </a>
                                <div class="dropdown-menu" role="menu">
                                    <t t-if="widget.editable">
                                        <a role="menuitem" type="edit" class="dropdown-item">Edit</a>
                                    </t>
                                    <t t-if="widget.deletable">
                                        <a role="menuitem" type="delete" class="dropdown-item">Delete</a>
                                    </t>
                                    <div role="separator" class="dropdown-divider"/>
                                    <ul class="oe_kanban_colorpicker" data-field="color"/>
                                </div>
                            </div>
                            <div class="oe_kanban_content">
                                <div class="o_kanban_record_top">
                                    <div class="o_kanban_record_headings">
                                        <h3 class="oe_margin_bottom_8 o_kanban_record_title"><field name="title" modifiers="{&quot;required&quot;: true}"/></h3>
                                    </div>
                                </div>
                                <div class="o_kanban_record_body">
                                    <field name="tag_ids" widget="many2many_tags" options="{'color_field': 'color'}" can_create="true" can_write="true" modifiers="{}"/>
                                    <ul id="o_utm_actions" class="list-group list-group-horizontal">
                <a name="action_redirect_to_social_media_posts" type="object" t-attf-class="#{record.social_posts_count.raw_value === 0 ? 'text-muted' : ''}">
                    <t t-out="record.social_posts_count.raw_value"/> Posts
                </a>
                                    </ul>
                                </div>
                                <div class="o_kanban_record_bottom h5 mt-2 mb-0">
                                    <div id="utm_statistics" class="d-flex flex-grow-1 text-600 mt-1">
                <div class="mr-3" title="Clicks">
                    <i class="fa fa-mouse-pointer text-muted"/>
                    <small class="font-weight-bold" t-esc="record.click_count.raw_value"/>
                </div>
                                    </div>
                                    <div class="oe_kanban_bottom_right">
                                         <field name="user_id" widget="many2one_avatar_user" can_create="true" can_write="true" modifiers="{&quot;required&quot;: true}"/>
                                    </div>
                                </div>
                            </div>
                            <div class="oe_clear"/>
                        </div>
                    </t>
                </templates>
            </kanban>
        `;
        const expected = `
            <t><kanban default_group_by="stage_id" class="o_utm_kanban" on_create="quick_create" quick_create_view="utm.utm_campaign_view_form_quick_create" examples="utm_campaign" sample="1">
                <span t-esc="record[&quot;color&quot;].value"/>
                <span t-esc="record[&quot;stage_id&quot;].value"/>
                <templates><t>
                    <div t-attf-class="oe_kanban_color_#{kanban_getcolor(record.color.raw_value)} oe_kanban_card oe_kanban_global_click" t-att-tabindex="props.record.model.useSampleModel?-1:0" role="article" t-att-data-id="props.canResequence and props.record.id" t-on-click="onGlobalClick" t-att-class="getRecordClasses()">
                        <Dropdown position="\`bottom-end\`" class="'o_dropdown_kanban'+' '+\`o_dropdown_kanban\`" togglerClass="\`btn dropdown - toggle o - no - caret btn\`" menuClass="\`dropdown - menu\`">
                            <t t-set-slot="toggler"><span class="fa fa-ellipsis-v"/></t>
                            <t t-if="widget.editable">
                                <a role="menuitem" class="dropdown-item oe_kanban_action oe_kanban_action_a" t-on-click="()=&gt;this.triggerAction({type:\`edit\`})" href="#">Edit</a>
                            </t>
                            <t t-if="widget.deletable">
                                <a role="menuitem" class="dropdown-item oe_kanban_action oe_kanban_action_a" t-on-click="()=&gt;this.triggerAction({type:\`delete \`})" href="#">Delete</a>
                            </t>
                            <div role="separator" class="dropdown-divider"/>
                            <t t-call="web.KanbanColorPicker" class="oe_kanban_colorpicker"/>
                        </Dropdown>
                        <div class="oe_kanban_content">
                            <div class="o_kanban_record_top">
                                <div class="o_kanban_record_headings">
                                    <h3 class="oe_margin_bottom_8 o_kanban_record_title"><span t-esc="record[&quot;title&quot;].value"/></h3>
                                </div>
                            </div>
                            <div class="o_kanban_record_body">
                                <Field id="'tag_ids'" name="'tag_ids'" record="props.record" fieldInfo="props.archInfo.fieldNodes['tag_ids']" type="'many2many_tags'" attrs="{'name':\`tag_ids\`,'widget':\`many2many_tags\`,'options':\`{ 'color_field': 'color' } \`,'can_create':\`true\`,'can_write':\`true\`,'modifiers':\`{ } \`}"/>
                                <ul id="o_utm_actions" class="list-group list-group-horizontal">
                                    <ViewButton tag="\`a\`" record="props.record" clickParams="{&quot;name&quot;:&quot;action_redirect_to_social_media_posts&quot;,&quot;type&quot;:&quot;object&quot;,&quot;debounce&quot;:&quot;300&quot;}" className="\`oe_kanban_action oe_kanban_action_a\`+\` \`+(record.social_posts_count.raw_value === 0 ? 'text-muted' : '')+\`\`">
                                        <t t-set-slot="contents">
                                            <t t-out="record.social_posts_count.raw_value"/> Posts
                                        </t>
                                    </ViewButton>
                                </ul>
                            </div>
                            <div class="o_kanban_record_bottom h5 mt-2 mb-0">
                                <div id="utm_statistics" class="d-flex flex-grow-1 text-600 mt-1">
                                    <div class="mr-3" title="Clicks">
                                        <i class="fa fa-mouse-pointer text-muted"/>
                                        <small class="font-weight-bold" t-esc="record.click_count.raw_value"/>
                                    </div>
                                </div>
                                <div class="oe_kanban_bottom_right">
                                    <Field id="'user_id'" name="'user_id'" record="props.record" fieldInfo="props.archInfo.fieldNodes['user_id']" type="'many2one_avatar_user'" attrs="{'name':\`user_id\`,'widget':\`many2one_avatar_user\`,'can_create':\`true\`,'can_write':\`true\`,'modifiers':\`{& quot; required & quot;: true }\`}"/>
                                </div>
                            </div>
                        </div>
                        <div class="oe_clear"/>
                    </div>
                </t></templates>
            </kanban></t>
        `;

        areEquivalent(assert, compileTemplate(arch), expected);
    });
});
