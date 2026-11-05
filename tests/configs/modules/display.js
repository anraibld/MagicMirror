const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	modules: [
		{
			module: "helloworld",
			position: "top_bar",
			header: "test_header",
			config: {
				text: "Test Display Header"
			}
		},
		{
			module: "helloworld",
			position: "bottom_bar",
			config: {
				text: "Test Hide Header"
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
