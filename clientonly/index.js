"use strict";

const http = require("node:http");
const https = require("node:https");

const getCommandLineParameter = (key, defaultValue = undefined) => {
	const index = process.argv.indexOf(`--${key}`);
	const value = index > -1 ? process.argv[index + 1] : undefined;
	return value !== undefined ? String(value) : defaultValue;
};

const getServerParameters = () => {
	const config = {};

	config.address = getCommandLineParameter("address", process.env.ADDRESS);
	const portValue = getCommandLineParameter("port", process.env.PORT);
	config.port = portValue ? parseInt(portValue, 10) : undefined;

	config.tls = process.argv.includes("--use-tls");

	return config;
};

const getServerConfig = (url) => {
	return new Promise((resolve, reject) => {
		const lib = url.startsWith("https") ? https : http;
		const request = lib.get(url, (response) => {
			let configData = "";

			response.on("data", (chunk) => {
				configData += chunk;
			});
			response.on("end", () => {
				try {
					resolve(JSON.parse(configData));
				} catch (parseError) {
					reject(new Error(`Failed to parse server response as JSON: ${parseError.message}`));
				}
			});
		});

		request.on("error", (error) => {
			reject(new Error(`Unable to read config from server (${url}) (${error.message})`));
		});
	});
};

const fail = (message, code = 1) => {
	if (message !== undefined && typeof message === "string") {
		console.error(message);
	} else {
		console.error("Usage: 'node clientonly --address 192.168.1.10 --port 8080 [--use-tls]'");
	}
	process.exit(code);
};

const startClient = async (config, prefix) => {
	try {
		const serverUrl = `${prefix}${config.address}:${config.port}/config/`;
		console.log(`Client: Connecting to server at ${serverUrl}`);
		const configReturn = await getServerConfig(serverUrl);
		console.log("Client: Successfully retrieved config from server");

		const elecParams = ["js/electron.js"];
		if (process.env.WAYLAND_DISPLAY) {
			console.log(`Client: Using WAYLAND_DISPLAY=${process.env.WAYLAND_DISPLAY}`);
			elecParams.push("--enable-features=UseOzonePlatform");
			elecParams.push("--ozone-platform=wayland");
		} else if (process.env.DISPLAY) {
			console.log(`Client: Using DISPLAY=${process.env.DISPLAY}`);
		} else {
			fail("Error: Requires environment variable WAYLAND_DISPLAY or DISPLAY, none is provided.");
		}

		const env = { ...process.env };
		env.clientonly = true;
		const options = { env: env };
		configReturn.address = config.address;
		configReturn.port = config.port;
		configReturn.tls = config.tls;
		env.config = JSON.stringify(configReturn);

		const electron = require("electron");
		const child = require("node:child_process").spawn(electron, elecParams, options);

		child.stdout.on("data", (buf) => {
			process.stdout.write(`Client: ${buf}`);
		});

		child.stderr.on("data", (buf) => {
			process.stderr.write(`Client: ${buf}`);
		});

		child.on("error", (err) => {
			process.stderr.write(`Client: ${err}`);
		});

		child.on("close", (code) => {
			if (code !== 0) {
				fail(`There is something wrong. The clientonly process exited with code ${code}.`);
			}
		});
	} catch (reason) {
		fail(`Unable to connect to server: (${reason})`);
	}
};

const config = getServerParameters();
const prefix = config.tls ? "https://" : "http://";

if (config.port !== undefined && (isNaN(config.port) || config.port < 1 || config.port > 65535)) {
	fail(`Invalid port number: ${config.port}. Port must be between 1 and 65535.`);
}

const LOCAL_ADDRESSES = ["localhost", "127.0.0.1", "::1", "::ffff:127.0.0.1"];
if (
	config.address
	&& config.port
	&& !LOCAL_ADDRESSES.includes(config.address)
) {
	startClient(config, prefix);
} else {
	fail();
}
