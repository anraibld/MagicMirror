if (typeof exports === "object") {
	exports.configFactory = (options) => {
		return Object.assign(
			{
				electronOptions: {
					webPreferences: {
						nodeIntegration: true,
						enableRemoteModule: true,
						contextIsolation: false
					}
				},

				modules: []
			},
			options
		);
	};
}
