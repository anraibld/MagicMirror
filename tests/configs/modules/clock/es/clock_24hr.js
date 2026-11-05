const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	language: "es",

	modules: [
		{
			module: "clock",
			position: "middle_center"
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
