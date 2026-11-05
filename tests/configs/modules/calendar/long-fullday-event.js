const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,

	modules: [
		{
			module: "calendar",
			position: "bottom_bar",
			config: {
				calendars: [
					{
						maximumNumberOfDays: 2,
						url: "http://localhost:8080/tests/mocks/calendar_test_multi_day_starting_today.ics"
					}
				]
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
