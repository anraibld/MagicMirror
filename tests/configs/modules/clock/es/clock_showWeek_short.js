const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	language: "es",
	timeFormat: 12,

	modules: [
		{
			module: "clock",
			position: "middle_center",
			config: {
				showWeek: "short"
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
