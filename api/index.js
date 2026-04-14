const { createServer } = require('http');
const { parse } = require('url');
const app = require('../server/index');

module.exports = (req, res) => {
  const server = createServer(app);
  server.emit('request', req, res);
};
