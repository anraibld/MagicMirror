const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,

	modules: [
		{
			module: "compliments",
			position: "middle_center",
			config: {
				compliments: {
					anytime: ["Anytime here"]
				}
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
