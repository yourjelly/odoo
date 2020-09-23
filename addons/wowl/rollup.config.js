export default {
  input: "static/dist/js/main.js",
  output: {
    file: "static/dist/wowl.js",
    format: "iife",
    name: "wowl",
    extend: true
  },
};
