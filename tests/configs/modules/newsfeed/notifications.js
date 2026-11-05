const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,

	modules: [
		{
			module: "newsfeed",
			position: "bottom_bar",
			config: {
				feeds: [
					{
						title: "Rodrigo Ramirez Blog",
						url: "http://localhost:8080/tests/mocks/newsfeed_test.xml"
					}
				],
				updateInterval: 3600 * 1000
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
