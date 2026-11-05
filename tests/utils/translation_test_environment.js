const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { JSDOM } = require("jsdom");

const TRANSLATOR_MODULE_URL = pathToFileURL(path.join(__dirname, "..", "..", "js", "translator.js")).href;

const resetTranslatorState = (Translator) => {
	for (const [key, value] of Object.entries(Translator)) {
		if (typeof value === "function") {
			continue;
		}

		if (Object.prototype.toString.call(value) === "[object Object]") {
			Translator[key] = {};
		}
	}
};

const setupTranslationTestEnvironment = (port = 3000) => {
	const dom = new JSDOM("", { url: `http://localhost:${port}` });

	global.document = dom.window.document;
	if (!global.Log) {
		global.Log = { log: vi.fn(), error: vi.fn() };
	}
};

module.exports = {
	setupTranslationTestEnvironment,
	TRANSLATOR_MODULE_URL,
	resetTranslatorState
};
