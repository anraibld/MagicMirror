const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	modules: [
		{
			module: "clock",
			position: "middle_center",
			config: {
				displayType: "analog",
				analogFace: "face-006",
				showDate: false
			}
		}
	]
};

if (typeof module !== "undefined") {
	module.exports = config;
}
