// Keep the repository-root entry point working for existing start commands.
const app = require("./backend/src/app.js");
require("./backend/src/server.js");

module.exports = app;
