const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	modules: [
		{
			module: "helloworld",
			position: "bottom_bar"
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
