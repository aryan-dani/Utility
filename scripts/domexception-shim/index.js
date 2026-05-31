// Local shim to replace the deprecated 'node-domexception' package.
// Node.js v18+ already provides DOMException globally.
module.exports = globalThis.DOMException || global.DOMException;
