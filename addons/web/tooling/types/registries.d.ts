declare module "registries" {
    import type { Component } from "@odoo/owl";
    import type { Services } from "services";
    import type { Model } from "@web/model/model";
    import type { Compiler } from "@web/views/view_compiler";
    import type {
        ActionRequest,
        ActionOptions,
        ActionMode,
        ActionDescription,
    } from "@web/webclient/actions/action_service";

    type TourStep = { run: string | (() => any); trigger: string; content?: String };
    type pyFieldType = "html" | "text" | "char" | "integer";
    export interface ItemTypes {
        "web_tour.tours": {
            steps: () => TourStep[];
            test?: boolean;
            url?: string;
        };
        services: {
            start: (env: any, deps: any) => any;
            async?: string[];
            dependencies?: string[];
        };
        fields: {
            component: typeof Component;
            displayName: String;
            supportedTypes?: string[];
            supportedOptions?: {
                label: String;
                name: string;
                type: string;
            }[];
            extractProps?: (fieldInfo: object, dynamicInfo: object) => object;
            isEmpty?: () => boolean;
            relatedFields?:
                | (() => { name: string; type: string; readonly?: boolean }[])
                | { name: string; type: string; readonly?: boolean }[];
            useSubView?: boolean;
            additionalClasses?: string[];
        };
        view_widgets: {
            component: typeof Component;
            extractProps?: (fieldInfo: object, dynamicInfo: object) => object;
            additionalClasses?: string[];
            fieldDependencies?: { name: string; string: String; type: string; readonly?: boolean };
        };
        lazy_components: typeof Component;
        main_components: { Component: typeof Component; props?: object };
        command_categories: object;
        command_provider: object;
        command_setup: object;
        debug: any;
        effects: (env: any, params: any) => void;
        error_handlers: (env: any, error: Erro, originalError: any) => boolean;
        error_dialogs: typeof Component;
        error_notifications: {
            title: String;
            message?: String;
            sticky?: boolean;
            type?: "info" | "warning" | "danger";
        };
        dialogs: typeof Component;
        parsers: (...args: any[]) => any;
        formatters: (value: any, options: any) => string;
        sample_server: (...args: any[]) => any;
        public_components: typeof Component;
        cogMenu: {
            Component: typeof Component;
            groupNumber: number;
            isDisplayed?: (env: any) => boolean;
        };
        favoriteMenu: { Component: typeof Component; groupNumber: number };
        views: {
            type: string;
            display_name: String;
            multiRecord: boolean;
            ArchParser: any;
            Controller: typeof Component;
            Model: Model;
            Renderer: typeof Component;
            props: (props, view) => any;
            searchMenuTypes?: string[];
            icon?: string;
            buttonTemplate?: string;
        };
        form_compilers: Compiler;
        kanban_header_config_items: {
            label: String;
            method: string;
            isVisible: () => boolean;
            class: string | ((options: any) => { [key: string]: boolean });
        };
        systray: {
            Component: typeof Component;
            isDisplayed?: (env: object) => boolean;
        };
        action_handlers: (params: {
            env: object;
            action: object;
            options: ActionOptions;
        }) => ActionRequest | void;
        actions: (((env: object, action: ActionDescription) => void) | typeof Component) & {
            target?: ActionMode;
            path?: string;
        };
        "ir.actions.report handlers": (
            action: ActionRequest,
            options: ActionOptions,
            env: object
        ) => ActionRequest | void;
    }
}
