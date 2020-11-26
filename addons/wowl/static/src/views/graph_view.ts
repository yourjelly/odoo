import { BaseView } from "./base_view";

// const { xml } = tags;

// class GraphRenderer extends Component<RendererProps, OdooEnv> {
//   static template = xml`
//       <div class="o_graph_renderer">
//         <h2>Graph view</h2>

//         <span><t t-esc="props.arch"/></span>
//       </div>
//     `;
// }

export class GraphView extends BaseView {
  // static components = { ...View.components, Renderer: GraphRenderer };
  static display_name = "graph";
  static icon = "fa-bar-chart";
  static multiRecord = true;
  static type = "graph";
}
