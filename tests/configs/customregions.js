const config = {
	address: "0.0.0.0",
	ipWhitelist: [],
	modules:
		(() => {
			const positions = ["row3_left", "top3_left1"];
			const modules = Array();
			for (const idx in positions) {
				modules.push({
					module: "helloworld",
					position: positions[idx],
					config: {
						text: `Text in ${positions[idx]}`
					}
				});
			}
			return modules;
		})()
};

if (typeof module !== "undefined") {
	module.exports = config;
}
