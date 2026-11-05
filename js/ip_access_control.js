const ipaddr = require("ipaddr.js");
const Log = require("logger");

const isIpInList = (clientIp, whitelist) => {
	try {
		const addr = ipaddr.process(clientIp);

		return whitelist.some((entry) => {
			try {
				if (entry.includes("/")) {
					const [rangeAddr, prefixLen] = ipaddr.parseCIDR(entry);
					return addr.match(rangeAddr, prefixLen);
				}

				const allowedAddr = ipaddr.process(entry);
				return addr.toString() === allowedAddr.toString();
			} catch {
				Log.warn(`Invalid whitelist entry: ${entry}`);
				return false;
			}
		});
	} catch {
		Log.warn(`Failed to parse client IP: ${clientIp}`);
		return false;
	}
};

const resolveClientIp = (req, trustedProxies = []) => {
	const directIp = req.socket?.remoteAddress || req.connection?.remoteAddress || req.ip;

	const peerIsTrustedProxy = Array.isArray(trustedProxies) && trustedProxies.length > 0 && isIpInList(directIp, trustedProxies);
	if (!peerIsTrustedProxy) {
		return directIp;
	}

	const forwardedFor = req.headers?.["x-forwarded-for"];
	if (typeof forwardedFor !== "string") {
		return directIp;
	}

	const forwardedIps = forwardedFor.split(",").map((entry) => entry.trim());
	const clientIp = forwardedIps.findLast((ip) => ip && !isIpInList(ip, trustedProxies));

	return clientIp;
};

const isSameOrigin = (req) => {
	const origin = req.headers?.origin;
	if (!origin) return true;

	const host = req.headers?.host;
	if (!host) return false;

	try {
		return new URL(origin).host === new URL(`http://${host}`).host;
	} catch {
		return false;
	}
};

const accessDenialReason = (req, whitelist, trustedProxies) => {
	if (!isSameOrigin(req)) return `Origin ${String(req.headers?.origin).replace(/[\r\n]/g, "")} is not allowed`;

	if (Array.isArray(whitelist) && whitelist.length > 0) {
		const clientIp = resolveClientIp(req, trustedProxies);
		if (!clientIp) {
			Log.warn("Could not determine client IP from trusted proxy headers");
			return "Client IP could not be determined";
		}
		if (!isIpInList(clientIp, whitelist)) return `IP ${clientIp} is not allowed`;
	}

	return null;
};

const ipAccessControl = (whitelist, trustedProxies) => {
	return (req, res, next) => {
		const reason = accessDenialReason(req, whitelist, trustedProxies);
		if (!reason) return next();

		Log.warn(`${reason} to access the mirror`);
		res.status(403).send("This device is not allowed to access your mirror. <br> Please check your config.js or config.js.sample to change this.");
	};
};

const socketIpAccessControl = (whitelist, trustedProxies) => {
	return (req, callback) => {
		const reason = accessDenialReason(req, whitelist, trustedProxies);
		if (!reason) return callback(null, true);

		Log.warn(`${reason} to connect to the mirror socket`);
		callback("This device is not allowed to access your mirror.", false);
	};
};

module.exports = { ipAccessControl, socketIpAccessControl };
