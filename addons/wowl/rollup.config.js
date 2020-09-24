export default {
  input: "static/dist/js/main.js",
  external: ["@odoo/owl"],
  output: {
    file: "static/dist/app.js",
    format: "iife",
    name: "wowl",
    extend: true,
    globals: { "@odoo/owl": "owl" },
  },
};
