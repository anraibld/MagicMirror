const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,

	modules: [
		{
			module: "clock",
			position: "middle_center",
			config: {
				showSunTimes: true,
				showMoonTimes: true
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
