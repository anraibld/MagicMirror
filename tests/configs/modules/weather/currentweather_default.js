const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,

	modules: [
		{
			module: "weather",
			position: "bottom_bar",
			config: {
				lat: 48.14,
				lon: 11.58,
				showHumidity: "feelslike",
				weatherProvider: "openweathermap",
				apiKey: "test-api-key"
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
