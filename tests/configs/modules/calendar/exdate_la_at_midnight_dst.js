const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,

	modules: [
		{
			module: "calendar",
			position: "bottom_bar",
			config: {
				maximumEntries: 100,
				calendars: [
					{
						maximumEntries: 100,
						maximumNumberOfDays: 28,
						url: "http://localhost:8080/tests/mocks/exdate_la_at_midnight_dst.ics"
					}
				]
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
