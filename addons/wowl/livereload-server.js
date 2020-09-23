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

function notifySockets() {
  for (let ws of openSockets) {
    ws.send("refresh");
  }
}

// File watcher
chokidar.watch("static/src").on("all", debounce(notifySockets, 20));

// Helper
function debounce(fn, delay) {
  let timeout = null;
  return () => {
    clearTimeout(timeout);
    timeout = setTimeout(fn, delay);
  };
}
