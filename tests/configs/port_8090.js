const config = require(`${process.cwd()}/tests/configs/default.js`).configFactory({
	port: 8090
});

if (typeof module !== "undefined") {
	module.exports = config;
}
