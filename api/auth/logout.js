const { buildClearCookie } = require('../_lib/auth');

module.exports = function handler(_req, res) {
  res.setHeader('Set-Cookie', buildClearCookie());
  return res.status(200).json({ ok: true });
};
