import { ClipboardPlugin } from "./core/clipboard_plugin";
import { CommentPlugin } from "./core/comment_plugin";
import { DeletePlugin } from "./core/delete_plugin";
import { DomPlugin } from "./core/dom_plugin";
import { FormatPlugin } from "./core/format_plugin";
import { HistoryPlugin } from "./core/history_plugin";
import { LineBreakPlugin } from "./core/line_break_plugin";
import { OverlayPlugin } from "./core/overlay_plugin";
import { ProtectedNodePlugin } from "./core/protected_node_plugin";
import { SanitizePlugin } from "./core/sanitize_plugin";
import { SelectionPlugin } from "./core/selection_plugin";
import { ShortCutPlugin } from "./core/shortcut_plugin";
import { SplitPlugin } from "./core/split_plugin";
import { TransientNodePlugin } from "./core/transient_node_plugin";
import { ZwsPlugin } from "./core/zws_plugin";
import { BannerPlugin } from "./main/banner_plugin";
import { ColumnPlugin } from "./main/column_plugin";
import { EmojiPlugin } from "./main/emoji_plugin";
import { ColorPlugin } from "./main/font/color_plugin";
import { FontPlugin } from "./main/font/font_plugin";
import { HintPlugin } from "./main/hint_plugin";
import { InlineCodePlugin } from "./main/inline_code";
import { JustifyPlugin } from "./main/justify_plugin";
import { LinkPastePlugin } from "./main/link/link_paste_plugin";
import { LinkPlugin } from "./main/link/link_plugin";
import { OdooLinkSelectionPlugin } from "./main/link/link_selection_odoo_plugin";
import { LinkSelectionPlugin } from "./main/link/link_selection_plugin";
import { ListPlugin } from "./main/list/list_plugin";
import { LocalOverlayPlugin } from "./main/local_overlay_plugin";
import { ImagePlugin } from "./main/media/image_plugin";
import { MediaPlugin } from "./main/media/media_plugin";
import { MoveNodePlugin } from "./main/movenode_plugin";
import { PositionPlugin } from "./main/position_plugin";
import { PowerboxPlugin } from "./main/powerbox/powerbox_plugin";
import { SearchPowerboxPlugin } from "./main/powerbox/search_powerbox_plugin";
import { SignaturePlugin } from "./main/signature_plugin";
import { StarPlugin } from "./main/star_plugin";
import { TablePlugin } from "./main/table/table_plugin";
import { TableResizePlugin } from "./main/table/table_resize_plugin";
import { TableUIPlugin } from "./main/table/table_ui_plugin";
import { TabulationPlugin } from "./main/tabulation_plugin";
import { TextDirectionPlugin } from "./main/text_direction_plugin";
import { ToolbarPlugin } from "./main/toolbar/toolbar_plugin";
import { YoutubePlugin } from "./main/youtube_plugin";
import { ChatGPTPlugin } from "./main/chatgpt/chatgpt_plugin";
import { CollaborationOdooPlugin } from "./others/collaboration/collaboration_odoo_plugin";
import { CollaborationPlugin } from "./others/collaboration/collaboration_plugin";
import { CollaborationSelectionAvatarPlugin } from "./others/collaboration/collaboration_selection_avatar_plugin";
import { CollaborationSelectionPlugin } from "./others/collaboration/collaboration_selection_plugin";
import { InlineComponentPlugin } from "./others/inline_component_plugin";
import { QWebPlugin } from "./others/qweb_plugin";

export const CORE_PLUGINS = [
    ClipboardPlugin,
    CommentPlugin,
    DeletePlugin,
    DomPlugin,
    FormatPlugin,
    HistoryPlugin,
    LineBreakPlugin,
    OverlayPlugin,
    ProtectedNodePlugin,
    TransientNodePlugin,
    SanitizePlugin,
    SelectionPlugin,
    SplitPlugin,
    ZwsPlugin,
];

export const MAIN_PLUGINS = [
    ...CORE_PLUGINS,
    BannerPlugin,
    ChatGPTPlugin,
    ColorPlugin,
    ColumnPlugin,
    EmojiPlugin,
    HintPlugin,
    JustifyPlugin,
    ListPlugin,
    MediaPlugin,
    ShortCutPlugin,
    PowerboxPlugin,
    SearchPowerboxPlugin,
    SignaturePlugin,
    StarPlugin,
    TablePlugin,
    TableUIPlugin,
    TabulationPlugin,
    ToolbarPlugin,
    FontPlugin, // note: if before ListPlugin, there are a few split tests that fails
    YoutubePlugin,
    ImagePlugin,
    LinkPlugin,
    LinkPastePlugin,
    LinkSelectionPlugin,
    OdooLinkSelectionPlugin,
    MoveNodePlugin,
    LocalOverlayPlugin,
    PositionPlugin,
    TextDirectionPlugin,
    InlineCodePlugin,
    TableResizePlugin,
];

export const COLLABORATION_PLUGINS = [
    CollaborationPlugin,
    CollaborationOdooPlugin,
    CollaborationSelectionPlugin,
    CollaborationSelectionAvatarPlugin,
];

export const EXTRA_PLUGINS = [
    ...COLLABORATION_PLUGINS,
    ...MAIN_PLUGINS,
    QWebPlugin,
    InlineComponentPlugin,
];
