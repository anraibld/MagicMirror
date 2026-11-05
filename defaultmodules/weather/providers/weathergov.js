const Log = require("logger");
const { getSunTimes, isDayTime, getDateString, convertKmhToMs, cardinalToDegrees } = require("../provider-utils");
const WeatherProvider = require("../weatherprovider");
const HTTPFetcher = require("#http_fetcher");

class WeatherGovProvider extends WeatherProvider {
	constructor (config) {
		super();
		this.config = {
			apiBase: "https://api.weather.gov/points/",
			lat: 0,
			lon: 0,
			type: "current",
			updateInterval: 10 * 60 * 1000,
			...config
		};

		this.initRetryCount = 0;
		this.initRetryTimer = null;

		this.forecastURL = null;
		this.forecastHourlyURL = null;
		this.forecastGridDataURL = null;
		this.observationStationsURL = null;
		this.stationObsURL = null;
	}

	async initialize () {
		const staggerDelay = Math.random() * 3000;
		await new Promise((resolve) => setTimeout(resolve, staggerDelay));

		try {
			await this.#fetchWeatherGovURLs();
			this.#initializeFetcher();
			this.initRetryCount = 0;
		} catch (error) {
			const errorInfo = this.#categorizeError(error);
			Log.error(`[weathergov] Initialization failed: ${errorInfo.message}`);

			if (errorInfo.isRetryable && this.initRetryCount < 5) {
				this.initRetryCount++;
				const delay = HTTPFetcher.calculateBackoffDelay(this.initRetryCount);
				Log.info(`[weathergov] Will retry initialization in ${Math.round(delay / 1000)}s (attempt ${this.initRetryCount}/5)`);
				this.initRetryTimer = setTimeout(() => this.initialize(), delay);
			} else if (this.onErrorCallback) {
				this.onErrorCallback({
					message: errorInfo.message,
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
		}
	}

	#categorizeError (error) {
		const cause = error.cause || error;
		const code = cause.code || "";

		if (code === "EAI_AGAIN" || code === "ENOTFOUND") {
			return {
				message: "DNS lookup failed for api.weather.gov - check your internet connection",
				isRetryable: true
			};
		}
		if (code === "ETIMEDOUT" || code === "ECONNREFUSED" || code === "ECONNRESET") {
			return {
				message: `Network error: ${code} - api.weather.gov may be temporarily unavailable`,
				isRetryable: true
			};
		}
		if (error.name === "AbortError") {
			return {
				message: "Request timeout - api.weather.gov is responding slowly",
				isRetryable: true
			};
		}

		return {
			message: error.message || "Unknown error",
			isRetryable: false
		};
	}

	stop () {
		super.stop();
		clearTimeout(this.initRetryTimer);
		this.initRetryTimer = null;
	}

	async #fetchWeatherGovURLs () {
		const pointsUrl = `${this.config.apiBase}${this.config.lat},${this.config.lon}`;

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 120000);

		try {
			const pointsResponse = await fetch(pointsUrl, {
				signal: controller.signal,
				headers: {
					"User-Agent": "MagicMirror",
					Accept: "application/geo+json"
				}
			});

			if (!pointsResponse.ok) {
				throw new Error(`Failed to fetch grid point: HTTP ${pointsResponse.status}`);
			}

			const pointsData = await pointsResponse.json();

			if (!pointsData || !pointsData.properties) {
				throw new Error("Invalid grid point data");
			}

			const relLoc = pointsData.properties.relativeLocation?.properties;
			if (relLoc) {
				this.locationName = `${relLoc.city}, ${relLoc.state}`;
			}

			this.forecastURL = `${pointsData.properties.forecast}?units=si`;
			this.forecastHourlyURL = `${pointsData.properties.forecastHourly}?units=si`;
			this.forecastGridDataURL = pointsData.properties.forecastGridData;
			this.observationStationsURL = pointsData.properties.observationStations;

			const stationsResponse = await fetch(this.observationStationsURL, {
				signal: controller.signal,
				headers: {
					"User-Agent": "MagicMirror",
					Accept: "application/geo+json"
				}
			});

			if (!stationsResponse.ok) {
				throw new Error(`Failed to fetch observation stations: HTTP ${stationsResponse.status}`);
			}

			const stationsData = await stationsResponse.json();

			if (!stationsData || !stationsData.features || stationsData.features.length === 0) {
				throw new Error("No observation stations found");
			}

			this.stationObsURL = `${stationsData.features[0].id}/observations/latest`;

			Log.log(`[weathergov] Initialized for ${this.locationName}`);
		} finally {
			clearTimeout(timeoutId);
		}
	}

	#initializeFetcher () {
		let url;

		switch (this.config.type) {
			case "current":
				url = this.stationObsURL;
				break;
			case "forecast":
			case "daily":
				url = this.forecastURL;
				break;
			case "hourly":
				url = this.forecastHourlyURL;
				break;
			default:
				url = this.stationObsURL;
		}

		this._createJSONFetcher({
			url,
			reloadInterval: this.config.updateInterval,
			timeout: 60000,
			headers: {
				"User-Agent": "MagicMirror",
				Accept: "application/geo+json",
				"Cache-Control": "no-cache"
			},
			logContext: "weatherprovider.weathergov"
		}, (data) => this.#handleResponse(data));
	}

	#handleResponse (data) {
		try {
			let weatherData;

			switch (this.config.type) {
				case "current":
					if (!data.properties) {
						throw new Error("Invalid current weather data");
					}
					weatherData = this.#generateWeatherObjectFromCurrentWeather(data.properties);
					break;
				case "forecast":
				case "daily":
					if (!data.properties || !data.properties.periods) {
						throw new Error("Invalid forecast data");
					}
					weatherData = this.#generateWeatherObjectsFromForecast(data.properties.periods);
					break;
				case "hourly":
					if (!data.properties || !data.properties.periods) {
						throw new Error("Invalid hourly data");
					}
					weatherData = this.#generateWeatherObjectsFromHourly(data.properties.periods);
					break;
				default:
					throw new Error(`Unknown weather type: ${this.config.type}`);
			}

			if (this.onDataCallback) {
				this.onDataCallback(weatherData);
			}
		} catch (error) {
			Log.error("[weathergov] Error processing weather data:", error);
			if (this.onErrorCallback) {
				this.onErrorCallback({
					message: error.message,
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
		}
	}

	#generateWeatherObjectFromCurrentWeather (currentWeatherData) {
		const current = {};

		current.date = new Date(currentWeatherData.timestamp);
		current.temperature = currentWeatherData.temperature.value;
		current.windSpeed = currentWeatherData.windSpeed.value;
		current.windFromDirection = currentWeatherData.windDirection.value;
		current.minTemperature = currentWeatherData.minTemperatureLast24Hours?.value;
		current.maxTemperature = currentWeatherData.maxTemperatureLast24Hours?.value;
		current.humidity = Math.round(currentWeatherData.relativeHumidity.value);
		current.precipitationAmount = currentWeatherData.precipitationLastHour?.value ?? currentWeatherData.precipitationLast3Hours?.value;

		if (currentWeatherData.heatIndex.value !== null) {
			current.feelsLikeTemp = currentWeatherData.heatIndex.value;
		} else if (currentWeatherData.windChill.value !== null) {
			current.feelsLikeTemp = currentWeatherData.windChill.value;
		} else {
			current.feelsLikeTemp = currentWeatherData.temperature.value;
		}

		const { sunrise, sunset } = getSunTimes(current.date, this.config.lat, this.config.lon);
		current.sunrise = sunrise;
		current.sunset = sunset;

		const isDay = isDayTime(current.date, current.sunrise, current.sunset);
		current.weatherType = this.#convertWeatherType(currentWeatherData.textDescription, isDay);

		return current;
	}

	#generateWeatherObjectsFromForecast (forecasts) {
		const days = [];
		let minTemp = [];
		let maxTemp = [];
		let date = "";
		let weather = {};

		for (const forecast of forecasts) {
			const forecastDate = new Date(forecast.startTime);
			const dateStr = getDateString(forecastDate);

			if (date !== dateStr) {
				if (date !== "") {
					weather.minTemperature = Math.min(...minTemp);
					weather.maxTemperature = Math.max(...maxTemp);
					days.push(weather);
				}

				weather = {};
				minTemp = [];
				maxTemp = [];
				date = dateStr;

				weather.date = forecastDate;
				weather.precipitationProbability = forecast.probabilityOfPrecipitation?.value ?? 0;
				weather.weatherType = this.#convertWeatherType(forecast.shortForecast, forecast.isDaytime);
			}

			const hour = forecastDate.getHours();
			if (hour >= 8 && hour <= 17) {
				weather.weatherType = this.#convertWeatherType(forecast.shortForecast, forecast.isDaytime);
			}

			minTemp.push(forecast.temperature);
			maxTemp.push(forecast.temperature);
		}

		if (date !== "") {
			weather.minTemperature = Math.min(...minTemp);
			weather.maxTemperature = Math.max(...maxTemp);
			days.push(weather);
		}

		return days;
	}

	#generateWeatherObjectsFromHourly (forecasts) {
		const hours = [];

		for (const forecast of forecasts) {
			const weather = {};

			weather.date = new Date(forecast.startTime);

			const windSpeedStr = forecast.windSpeed;
			let windSpeed = windSpeedStr;
			if (windSpeedStr.includes(" ")) {
				windSpeed = windSpeedStr.split(" ")[0];
			}
			weather.windSpeed = convertKmhToMs(parseFloat(windSpeed));
			weather.windFromDirection = cardinalToDegrees(forecast.windDirection);
			weather.temperature = forecast.temperature;
			weather.precipitationProbability = forecast.probabilityOfPrecipitation?.value ?? 0;
			weather.weatherType = this.#convertWeatherType(forecast.shortForecast, forecast.isDaytime);

			hours.push(weather);
		}

		return hours;
	}

	#convertWeatherType (weatherType, isDaytime) {

		if (weatherType.includes("Cloudy") || weatherType.includes("Partly")) {
			return isDaytime ? "day-cloudy" : "night-cloudy";
		} else if (weatherType.includes("Overcast")) {
			return isDaytime ? "cloudy" : "night-cloudy";
		} else if (weatherType.includes("Freezing") || weatherType.includes("Ice")) {
			return "rain-mix";
		} else if (weatherType.includes("Snow")) {
			return isDaytime ? "snow" : "night-snow";
		} else if (weatherType.includes("Thunderstorm")) {
			return isDaytime ? "thunderstorm" : "night-thunderstorm";
		} else if (weatherType.includes("Showers")) {
			return isDaytime ? "showers" : "night-showers";
		} else if (weatherType.includes("Rain") || weatherType.includes("Drizzle")) {
			return isDaytime ? "rain" : "night-rain";
		} else if (weatherType.includes("Breezy") || weatherType.includes("Windy")) {
			return isDaytime ? "cloudy-windy" : "night-alt-cloudy-windy";
		} else if (weatherType.includes("Fair") || weatherType.includes("Clear") || weatherType.includes("Few") || weatherType.includes("Sunny")) {
			return isDaytime ? "day-sunny" : "night-clear";
		} else if (weatherType.includes("Dust") || weatherType.includes("Sand")) {
			return "dust";
		} else if (weatherType.includes("Fog")) {
			return "fog";
		} else if (weatherType.includes("Smoke")) {
			return "smoke";
		} else if (weatherType.includes("Haze")) {
			return "day-haze";
		}

		return null;
	}
}

module.exports = WeatherGovProvider;
