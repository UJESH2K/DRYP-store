const crypto = require('crypto');

const hashPasswordToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

const createPasswordToken = (ttlMs) => {
  const rawToken = crypto.randomBytes(20).toString('hex');
  return {
    rawToken,
    hashedToken: hashPasswordToken(rawToken),
    expiresAt: Date.now() + ttlMs,
  };
};

module.exports = {
  createPasswordToken,
  hashPasswordToken,
};
