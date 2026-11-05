const Log = require("logger");
const HTTPFetcher = require("#http_fetcher");

class WeatherProvider {

	constructor () {
		this.fetcher = null;
		this.onDataCallback = null;
		this.onErrorCallback = null;
		this.locationName = null;
	}

	setCallbacks (onData, onError) {
		this.onDataCallback = onData;
		this.onErrorCallback = onError;
	}

	start (initialDelay = 0) {
		this.fetcher?.startPeriodicFetch(initialDelay);
	}

	stop () {
		this.fetcher?.clearTimer();
	}

	_createJSONFetcher (options, onData) {
		this.fetcher = new HTTPFetcher(options);

		this.fetcher.on("response", async (response) => {
			if (response.status === 304) return;

			let data;
			try {
				data = await response.json();
			} catch (error) {
				Log.error(`[${this.constructor.name}] Failed to parse JSON:`, error);
				this.onErrorCallback?.({
					message: "Failed to parse API response",
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
				return;
			}

			try {
				onData(data);
			} catch (error) {
				Log.error(`[${this.constructor.name}] Failed to process weather data:`, error);
				this.onErrorCallback?.({
					message: "Failed to process weather data",
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
		});

		this.fetcher.on("error", (errorInfo) => {
			this.onErrorCallback?.(errorInfo);
		});
	}
}

module.exports = WeatherProvider;
