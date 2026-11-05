import "./logger.js";
import "../config/basepath.js";

const socketIo = await import( "/socket.io/socket.io.esm.min.js");
const { io } = socketIo;

if (typeof io !== "function") {
	throw new Error("Socket.IO client did not provide a callable io export.");
}

export { io };

export const MMSocket = function (moduleName) {
	if (typeof moduleName !== "string") {
		throw new Error("Please set the module name for the MMSocket.");
	}

	this.moduleName = moduleName;

	const base = globalThis.config?.basePath ?? "/";
	this.socket = io(`/${this.moduleName}`, {
		path: `${base}socket.io`,
		pingInterval: 120000,
		pingTimeout: 120000
	});

	let notificationCallback = () => {};

	const onevent = this.socket.onevent;
	this.socket.onevent = (packet) => {
		const args = packet.data || [];
		onevent.call(this.socket, packet);
		packet.data = ["*"].concat(args);
		onevent.call(this.socket, packet);
	};

	this.socket.on("*", (notification, payload) => {
		if (notification !== "*") {
			notificationCallback(notification, payload);
		}
	});

	this.setNotificationCallback = (callback) => {
		notificationCallback = callback;
	};

	this.sendNotification = (notification, payload = {}) => {
		this.socket.emit(notification, payload);
	};
};

globalThis.io = io;

if (!globalThis.MMSocket) globalThis.MMSocket = MMSocket;
