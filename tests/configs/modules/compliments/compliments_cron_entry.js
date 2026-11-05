const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	modules: [
		{
			module: "compliments",
			position: "middle_center",
			config: {
				specialDayUnique: true,
				compliments: {
					anytime: ["just a test"],
					"00-10 16-19 * * fri": ["just pub time"]
				}
			}
		}
	]
};

if (typeof module !== "undefined") { module.exports = config; }
