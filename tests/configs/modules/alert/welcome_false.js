const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	modules: [
		{
			module: "alert",
			config: {
				display_time: 1000000,
				welcome_message: false
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
