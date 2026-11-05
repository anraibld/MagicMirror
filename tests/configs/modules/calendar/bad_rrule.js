const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,
	logLevel: ["INFO", "LOG", "WARN", "ERROR", "DEBUG"],
	modules: [
		{
			module: "calendar",
			position: "bottom_bar",
			config: {
				calendars: [
					{
						url: "http://localhost:8080/tests/mocks/bad_rrule.ics"
					}
				]
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
