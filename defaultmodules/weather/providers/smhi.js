const Log = require("logger");
const { getSunTimes, isDayTime, validateCoordinates } = require("../provider-utils");
const WeatherProvider = require("../weatherprovider");

const PRECIP_VALUE_MAP = {
	pmin: "precipitation_amount_min",
	pmean: "precipitation_amount_mean",
	pmedian: "precipitation_amount_median",
	pmax: "precipitation_amount_max"
};

class SMHIProvider extends WeatherProvider {
	constructor (config) {
		super();
		this.config = {
			lat: 0,
			lon: 0,
			precipitationValue: "pmedian",
			type: "current",
			updateInterval: 5 * 60 * 1000,
			...config
		};

		if (!Object.keys(PRECIP_VALUE_MAP).includes(this.config.precipitationValue)) {
			Log.warn(`[smhi] Invalid precipitationValue: ${this.config.precipitationValue}, using pmedian`);
			this.config.precipitationValue = "pmedian";
		}
	}

	initialize () {
		try {
			validateCoordinates(this.config, 6);
			this.#initializeFetcher();
		} catch (error) {
			Log.error("[smhi] Initialization failed:", error);
			if (this.onErrorCallback) {
				this.onErrorCallback({
					message: error.message,
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
		}
	}

	#initializeFetcher () {
		const url = this.#getUrl();

		this._createJSONFetcher({
			url,
			reloadInterval: this.config.updateInterval,
			logContext: "weatherprovider.smhi"
		}, (data) => this.#handleResponse(data));
	}

	#handleResponse (data) {
		try {
			if (!data.timeSeries || !Array.isArray(data.timeSeries)) {
				throw new Error("Invalid weather data");
			}

			const coordinates = this.#resolveCoordinates(data);
			let weatherData;

			switch (this.config.type) {
				case "current":
					weatherData = this.#generateCurrentWeather(data.timeSeries, coordinates);
					break;
				case "forecast":
				case "daily":
					weatherData = this.#generateForecast(data.timeSeries, coordinates);
					break;
				case "hourly":
					weatherData = this.#generateHourly(data.timeSeries, coordinates);
					break;
				default:
					Log.error(`[smhi] Unknown weather type: ${this.config.type}`);
					if (this.onErrorCallback) {
						this.onErrorCallback({
							message: `Unknown weather type: ${this.config.type}`,
							translationKey: "MODULE_ERROR_UNSPECIFIED"
						});
					}
					return;
			}

			if (this.onDataCallback) {
				this.onDataCallback(weatherData);
			}
		} catch (error) {
			Log.error("[smhi] Error processing weather data:", error);
			if (this.onErrorCallback) {
				this.onErrorCallback({
					message: error.message,
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
		}
	}

	#generateCurrentWeather (timeSeries, coordinates) {
		const closest = this.#getClosestToCurrentTime(timeSeries);
		return this.#convertWeatherDataToObject(closest, coordinates);
	}

	#generateForecast (timeSeries, coordinates) {
		const filled = this.#fillInGaps(timeSeries);
		return this.#convertWeatherDataGroupedBy(filled, coordinates, "day");
	}

	#generateHourly (timeSeries, coordinates) {
		const filled = this.#fillInGaps(timeSeries);
		return this.#convertWeatherDataGroupedBy(filled, coordinates, "hour");
	}

	#getClosestToCurrentTime (times) {
		const now = new Date();
		let minDiff = null;
		let closest = times[0];

		for (const time of times) {
			const entryTime = new Date(time.time);
			const diff = Math.abs(entryTime - now);

			if (minDiff === null || diff < minDiff) {
				minDiff = diff;
				closest = time;
			}
		}

		return closest;
	}

	#convertWeatherDataToObject (weatherData, coordinates) {
		const date = new Date(weatherData.time);
		const { sunrise, sunset } = getSunTimes(date, coordinates.lat, coordinates.lon);
		const isDay = isDayTime(date, sunrise, sunset);

		const current = {
			date: date,
			humidity: this.#paramValue(weatherData, "relative_humidity"),
			temperature: this.#paramValue(weatherData, "air_temperature"),
			windSpeed: this.#paramValue(weatherData, "wind_speed"),
			windFromDirection: this.#paramValue(weatherData, "wind_from_direction"),
			weatherType: this.#convertWeatherType(this.#paramValue(weatherData, "symbol_code"), isDay),
			feelsLikeTemp: this.#calculateApparentTemperature(weatherData),
			sunrise: sunrise,
			sunset: sunset,
			snow: 0,
			rain: 0,
			precipitationAmount: 0
		};

		const precipParamName = PRECIP_VALUE_MAP[this.config.precipitationValue];
		const precipitationValue = this.#paramValue(weatherData, precipParamName);
		const pcat = this.#paramValue(weatherData, "predominant_precipitation_type_at_surface");

		switch (pcat) {
			case 1:
			case 11:
				current.rain = precipitationValue;
				current.precipitationAmount = precipitationValue;
				break;
			case 2:
				current.snow = precipitationValue / 2;
				current.rain = precipitationValue / 2;
				current.precipitationAmount = precipitationValue;
				break;
			case 5:
			case 6:
				current.snow = precipitationValue;
				current.precipitationAmount = precipitationValue;
				break;
			case 0:
			default:
				break;
		}

		return current;
	}

	#convertWeatherDataGroupedBy (allWeatherData, coordinates, groupBy = "day") {
		const result = [];
		let currentWeather = null;
		let dayWeatherTypes = [];

		const allWeatherObjects = allWeatherData.map((data) => this.#convertWeatherDataToObject(data, coordinates));

		for (const weatherObject of allWeatherObjects) {
			const objDate = new Date(weatherObject.date);

			const needNewGroup = !currentWeather || !this.#isSamePeriod(currentWeather.date, objDate, groupBy);

			if (needNewGroup) {
				currentWeather = {
					date: objDate,
					temperature: weatherObject.temperature,
					minTemperature: Infinity,
					maxTemperature: -Infinity,
					snow: 0,
					rain: 0,
					precipitationAmount: 0,
					sunrise: weatherObject.sunrise,
					sunset: weatherObject.sunset
				};
				dayWeatherTypes = [];
				result.push(currentWeather);
			}

			const { sunrise: daySunrise, sunset: daySunset } = getSunTimes(objDate, coordinates.lat, coordinates.lon);
			const isDay = isDayTime(objDate, daySunrise, daySunset);

			if (isDay) {
				dayWeatherTypes.push(weatherObject.weatherType);
			}

			if (dayWeatherTypes.length > 0) {
				currentWeather.weatherType = dayWeatherTypes[Math.floor(dayWeatherTypes.length / 2)];
			} else {
				currentWeather.weatherType = weatherObject.weatherType;
			}

			currentWeather.minTemperature = Math.min(currentWeather.minTemperature, weatherObject.temperature);
			currentWeather.maxTemperature = Math.max(currentWeather.maxTemperature, weatherObject.temperature);
			currentWeather.snow += weatherObject.snow;
			currentWeather.rain += weatherObject.rain;
			currentWeather.precipitationAmount += weatherObject.precipitationAmount;
		}

		return result;
	}

	#isSamePeriod (date1, date2, groupBy) {
		if (groupBy === "hour") {
			return date1.getFullYear() === date2.getFullYear()
			  && date1.getMonth() === date2.getMonth()
			  && date1.getDate() === date2.getDate()
			  && date1.getHours() === date2.getHours();
		} else {
			return date1.getFullYear() === date2.getFullYear()
			  && date1.getMonth() === date2.getMonth()
			  && date1.getDate() === date2.getDate();
		}
	}

	#fillInGaps (data) {
		if (data.length === 0) return [];

		const result = [];
		result.push(data[0]);

		for (let i = 1; i < data.length; i++) {
			const from = new Date(data[i - 1].time);
			const to = new Date(data[i].time);
			const hours = Math.floor((to - from) / (1000 * 60 * 60));

			for (let j = 1; j < hours; j++) {
				const current = { ...data[i - 1] };
				const newTime = new Date(from);
				newTime.setHours(from.getHours() + j);
				current.time = newTime.toISOString();
				result.push(current);
			}

			result.push(data[i]);
		}

		return result;
	}

	#resolveCoordinates (data) {
		const coords = data?.geometry?.coordinates;

		if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === "number") {
			return {
				lat: coords[1],
				lon: coords[0]
			};
		}

		Log.warn("[smhi] Invalid coordinate structure in response, using config values");
		return {
			lat: this.config.lat,
			lon: this.config.lon
		};
	}

	#calculateApparentTemperature (weatherData) {
		const Ta = this.#paramValue(weatherData, "air_temperature");
		const rh = this.#paramValue(weatherData, "relative_humidity");
		const ws = this.#paramValue(weatherData, "wind_speed");

		if (Ta === null || rh === null || ws === null) {
			return Ta;
		}

		const p = (rh / 100) * 6.105 * Math.exp((17.27 * Ta) / (237.7 + Ta));
		return Ta + 0.33 * p - 0.7 * ws - 4;
	}

	#paramValue (weatherData, name) {
		const value = weatherData.data?.[name];

		if (value === undefined || value === null) {
			return null;
		}

		if (value === 9999) {
			return null;
		}

		return value;
	}

	#convertWeatherType (input, isDayTime) {
		switch (input) {
			case 1:
				return isDayTime ? "day-sunny" : "night-clear";
			case 2:
				return isDayTime ? "day-sunny-overcast" : "night-partly-cloudy";
			case 3:
			case 4:
				return isDayTime ? "day-cloudy" : "night-cloudy";
			case 5:
			case 6:
				return "cloudy";
			case 7:
				return "fog";
			case 8:
			case 9:
			case 10:
				return "showers";
			case 11:
			case 21:
				return "thunderstorm";
			case 12:
			case 13:
			case 14:
			case 22:
			case 23:
			case 24:
				return "sleet";
			case 15:
			case 16:
			case 17:
			case 25:
			case 26:
			case 27:
				return "snow";
			case 18:
			case 19:
			case 20:
				return "rain";
			default:
				return null;
		}
	}

	#getUrl () {
		const lon = this.config.lon.toFixed(6);
		const lat = this.config.lat.toFixed(6);
		return `https://opendata-download-metfcst.smhi.se/api/category/snow1g/version/1/geotype/point/lon/${lon}/lat/${lat}/data.json`;
	}
}

module.exports = SMHIProvider;
