const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	timeFormat: 12,

	modules: [
		{
			module: "calendar",
			position: "bottom_bar",
			config: {
				hideDuplicates: false,
				maximumEntries: 100,
				sliceMultiDayEvents: true,
				calendars: [
					{
						maximumEntries: 100,
						url: "http://localhost:8080/tests/mocks/sliceMultiDayEvents.ics"
					}
				]
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
