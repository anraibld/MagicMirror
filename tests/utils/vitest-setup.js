
const Module = require("node:module");
const path = require("node:path");

vi.doMock(path.resolve(__dirname, "../..", "js", "socketclient.js"), () => ({
	io () {},
	MMSocket () {}
}));

process.env.mmTestMode = "true";

Object.defineProperty(globalThis, "localStorage", { value: undefined, writable: true });

const originalRequire = Module.prototype.require;

let logLevelApplied = false;

Module.prototype.require = function (id) {
	if (id === "logger") {
		const logger = originalRequire.call(this, path.resolve(__dirname, "../../js/logger.js"));

		if (!logLevelApplied && process.env.CI === "true") {
			logger.setLogLevel("ERROR");
			logLevelApplied = true;
		}

		return logger;
	}

	return originalRequire.apply(this, arguments);
};
