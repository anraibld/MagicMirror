const config = require(`${process.cwd()}/tests/configs/default.js`).configFactory({
	ipWhitelist: ["x.x.x.x"],
	port: 8181
});

if (typeof module !== "undefined") {
	module.exports = config;
}
