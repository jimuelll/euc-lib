const app = require("./app");
require("dotenv").config();
const http = require("http");
const { attachWebSocketServer } = require("./realtime/websocket");

const PORT = process.env.PORT || 4000;

const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
