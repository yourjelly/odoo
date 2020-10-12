const WebSocket = require("ws");
const chokidar = require("chokidar");

const PORT = 8070;
const openSockets = new Set();

// Websocket server
const wss = new WebSocket.Server({ port: PORT });
console.log(`[livereload] server started (port ${PORT})`);

wss.on("connection", (ws) => {
  console.log("[livereload] connection established");
  openSockets.add(ws);

  ws.on("close", () => {
    openSockets.delete(ws);
  });
});

function notifySockets(message) {
  for (let ws of openSockets) {
    ws.send(message);
  }
}

function makeNotifier() {
  let timeout = null;
  let onlyCSS = true;
  return (_type, file) => {
    onlyCSS = onlyCSS && file.endsWith("css");
    clearTimeout(timeout);
    setTimeout(() => {
      const msg = onlyCSS ? "refresh:css" : "refresh";
      onlyCSS = true;
      notifySockets(msg);
    }, 300);
  };
}

// File watcher
chokidar.watch("static", { ignored: /.*\.ts$/ }).on("all", makeNotifier());
