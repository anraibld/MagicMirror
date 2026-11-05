require("../js/alias-resolver");

const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const net = require("node:net");
const http = require("node:http");
const Log = require("logger");
const { getConfigFilePath, getServerPort } = require("#server_functions");

const RESTART_DELAY_MS = 500;
const PORT_CHECK_MAX_ATTEMPTS = 20;
const PORT_CHECK_INTERVAL_MS = 500;

let child = null;
let restartTimer = null;
let isShuttingDown = false;
let isRestarting = false;
let serverConfig = null;
const rootDir = path.join(__dirname, "..");

const getServerConfig = () => {
	if (serverConfig) return serverConfig;

	try {
		const configPath = getConfigFilePath();
		delete require.cache[require.resolve(configPath)];
		const config = require(configPath);
		serverConfig = {
			port: getServerPort(config),
			address: config.address || "localhost"
		};
	} catch {
		serverConfig = { port: 8080, address: "localhost" };
	}

	return serverConfig;
};

const isPortAvailable = (port) => {
	return new Promise((resolve) => {
		const server = net.createServer();

		server.once("error", () => {
			resolve(false);
		});

		server.once("listening", () => {
			server.close();
			resolve(true);
		});

		const { address } = getServerConfig();
		server.listen(port, address);
	});
};

const waitForPort = async (port, maxAttempts = PORT_CHECK_MAX_ATTEMPTS) => {
	for (let i = 0; i < maxAttempts; i++) {
		if (await isPortAvailable(port)) {
			Log.info(`Port ${port} is now available`);
			return;
		}
		await new Promise((resolve) => setTimeout(resolve, PORT_CHECK_INTERVAL_MS));
	}
	Log.warn(`Port ${port} still not available after ${maxAttempts} attempts`);
};

const startServer = () => {
	child = spawn("node", ["./serveronly"], {
		stdio: "inherit",
		cwd: path.join(__dirname, "..")
	});

	child.on("error", (error) => {
		Log.error("Failed to start server process:", error.message);
		child = null;
	});

	child.on("exit", (code, signal) => {
		child = null;

		if (isShuttingDown) {
			return;
		}

		if (isRestarting) {
			isRestarting = false;
		} else {
			Log.error(`Server exited unexpectedly with code ${code} and signal ${signal}`);
		}
	});
};

const notifyClientsToReload = () => {
	const { port, address } = getServerConfig();
	const options = {
		hostname: address,
		port: port,
		path: "/reload",
		method: "GET"
	};

	const req = http.request(options, (res) => {
		if (res.statusCode === 200) {
			Log.info("Reload notification sent to clients");
		}
	});

	req.on("error", (err) => {
		Log.debug(`Could not send reload notification: ${err.message}`);
	});

	req.end();
};

const restartServer = (reason) => {
	if (restartTimer) clearTimeout(restartTimer);

	restartTimer = setTimeout(() => {
		Log.info(reason);

		if (child) {
			isRestarting = true;

			const { port } = getServerConfig();

			notifyClientsToReload();

			child.once("exit", async () => {
				await waitForPort(port);
				serverConfig = null;
				startServer();
			});

			child.kill("SIGTERM");
		} else {
			startServer();
		}
	}, RESTART_DELAY_MS);
};

const watchFile = (file) => {
	try {
		const fileName = path.basename(file);
		const dirName = path.dirname(file);

		const watcher = fs.watch(dirName, (_eventType, changedFile) => {
			if (changedFile !== fileName) return;

			Log.info(`[watchFile] Change detected in: ${file}`);
			if (restartTimer) clearTimeout(restartTimer);

			restartTimer = setTimeout(() => {
				Log.info(`[watchFile] Triggering restart due to change in: ${file}`);
				restartServer(`File changed: ${path.basename(file)} — restarting...`);
			}, RESTART_DELAY_MS);
		});

		watcher.on("error", (error) => {
			Log.error(`Watcher error for ${file}:`, error.message);
		});

		Log.log(`Watching file: ${file}`);
	} catch (error) {
		Log.error(`Failed to watch file ${file}:`, error.message);
	}
};

startServer();

try {
	const configPath = getConfigFilePath();
	delete require.cache[require.resolve(configPath)];
	const config = require(configPath);

	let watchTargets = [];
	if (Array.isArray(config.watchTargets) && config.watchTargets.length > 0) {
		watchTargets = config.watchTargets.filter((target) => typeof target === "string" && target.trim() !== "");
	}

	if (watchTargets.length === 0) {
		Log.warn("Watch mode is enabled but no watchTargets are configured. No files will be monitored. Set the watchTargets array in your config.js to enable file watching.");
	}

	Log.log(`Watch mode enabled. Watching ${watchTargets.length} file(s)`);

	for (const target of watchTargets) {
		const targetPath = path.isAbsolute(target)
			? target
			: path.join(rootDir, target);

		if (!fs.existsSync(targetPath)) {
			Log.warn(`Watch target does not exist: ${targetPath}`);
			continue;
		}

		const stats = fs.statSync(targetPath);
		if (stats.isFile()) {
			watchFile(targetPath);
		} else {
			Log.warn(`Watch target is not a file (directories not supported): ${targetPath}`);
		}
	}
} catch {
	Log.warn("Could not load watchTargets from config.");
}

process.on("SIGINT", () => {
	isShuttingDown = true;
	if (restartTimer) clearTimeout(restartTimer);
	if (child) child.kill("SIGTERM");
	process.exit(0);
});
