const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
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
