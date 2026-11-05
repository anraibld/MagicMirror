const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { chromium } = require("playwright");

global.root_path = path.resolve(`${__dirname}/../../../`);

const indexFile = `${global.root_path}/index.html`;
const cssFile = `${global.root_path}/config/custom.css`;
const sampleCss = [
	".region.row3 {",
	" top: 0;",
	"}",
	".region.row3.left {",
	" top: 100%;",
	"}"
];
let indexData = "";
let cssData = "";

let browser;
let context;
let page;

const ensureContext = async () => {
	if (!browser) {
		const launchOptions = {
			headless: true,
			args: [
				"--disable-dev-shm-usage",
				"--disable-gpu",
				"--no-sandbox",
				"--disable-setuid-sandbox",
				"--single-process"
			]
		};
		browser = await chromium.launch(launchOptions);
	}
	if (!context) {
		context = await browser.newContext();
	}
};

const openPage = async (url) => {
	await ensureContext();
	if (page) {
		await page.close();
	}
	page = await context.newPage();
	await page.goto(url, { waitUntil: "load" });
	return page;
};

const closeBrowser = async () => {
	if (page) {
		await page.close();
		page = null;
	}
	if (context) {
		await context.close();
		context = null;
	}
	if (browser) {
		await browser.close();
		browser = null;
	}
};

exports.getPage = () => {
	if (!page) {
		throw new Error("Playwright page is not initialized. Call getDocument() first.");
	}
	return page;
};

exports.startApplication = async (configFilename) => {
	vi.resetModules();

	Object.keys(require.cache).forEach((key) => {
		if (
			key.includes("/tests/configs/")
			|| key.includes("/config/config")
			|| key.includes("/js/app.js")
			|| key.includes("/js/server.js")
		) {
			delete require.cache[key];
		}
	});

	if (global.app) {
		await exports.stopApplication();
	}

	const port = Number(process.env.MM_PORT) || 8080;
	global.testPort = port;

	let configPath;
	if (configFilename === "") {
		configPath = "config/config.js";
	} else {
		configPath = configFilename;
	}

	process.env.MM_CONFIG_FILE = configPath;

	process.env.MM_PORT = port.toString();

	process.env.mmTestMode = "true";
	process.setMaxListeners(0);
	global.app = require(`${global.root_path}/js/app`);

	return global.app.start();
};

exports.stopApplication = async (waitTime = 100) => {
	await closeBrowser();

	if (!global.app) {
		delete global.testPort;
		return Promise.resolve();
	}

	await global.app.stop();
	delete global.app;
	delete global.testPort;
	delete process.env.MM_PORT;

	await new Promise((resolve) => setTimeout(resolve, waitTime));
};

exports.getDocument = async () => {
	const port = global.testPort || global.config.port || 8080;
	const address = global.config.address === "0.0.0.0" ? "localhost" : global.config.address || "localhost";
	const url = `http://${address}:${port}`;

	await openPage(url);
};

exports.fixupIndex = async () => {
	indexData = (await fs.promises.readFile(indexFile)).toString();
	const workIndexLines = indexData.split(os.EOL);
	for (const l in workIndexLines) {
		if (workIndexLines[l].includes("region top right")) {
			workIndexLines.splice(l, 0, "      <div class=\"region row3 left\"><div class=\"container\"></div></div>");
			break;
		}
	}
	await fs.promises.writeFile(indexFile, workIndexLines.join(os.EOL), { flush: true });
	cssData = (await fs.promises.readFile(cssFile)).toString();
	await fs.promises.writeFile(cssFile, sampleCss.join(os.EOL), { flush: true });
};

exports.restoreIndex = async () => {
	if (indexData.length > 0) {
		await fs.promises.writeFile(indexFile, indexData, { flush: true });
		await fs.promises.writeFile(cssFile, cssData, { flush: true });
	}
};
