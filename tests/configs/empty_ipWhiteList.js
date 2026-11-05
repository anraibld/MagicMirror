const config = require(`${process.cwd()}/tests/configs/default.js`).configFactory({
	ipWhitelist: [],
	port: 8282
});

if (typeof module !== "undefined") {
	module.exports = config;
}
