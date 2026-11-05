const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	modules: [
		{
			module: "compliments",
			position: "bottom_bar",
			config: {
				updateInterval: 3000,
				remoteFile: "http://localhost:8080/tests/mocks/compliments_test.json"
			}
		}
	]
};

if (typeof module !== "undefined") { module.exports = config; }
