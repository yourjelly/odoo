import { Registry } from "../core/registry";
import { View } from "../types";
import { GraphView } from "./graph/graph_view";
import { ListView } from "./list/list_view";

export const viewRegistry: Registry<View> = new Registry();

// viewRegistry.add("form", FormView);
viewRegistry.add("graph", GraphView);
viewRegistry.add("list", ListView);
