const Log = require("logger");
const { convertKmhToMs } = require("../provider-utils");
const WeatherProvider = require("../weatherprovider");

class WeatherFlowProvider extends WeatherProvider {

	constructor (config) {
		super();
		this.config = config;
	}

	initialize () {
		if (!this.config.token || this.config.token === "YOUR_API_TOKEN_HERE") {
			Log.error("[weatherflow] No API token configured. Get one at https://tempestwx.com/");
			if (this.onErrorCallback) {
				this.onErrorCallback({
					message: "WeatherFlow API token required. Get one at https://tempestwx.com/",
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
			return;
		}

		if (!this.config.stationid) {
			Log.error("[weatherflow] No station ID configured");
			if (this.onErrorCallback) {
				this.onErrorCallback({
					message: "WeatherFlow station ID required",
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
			return;
		}

		this.#initializeFetcher();
	}

	#initializeFetcher () {
		const url = this.#getUrl();

		this._createJSONFetcher({
			url,
			reloadInterval: this.config.updateInterval,
			headers: {
				"Cache-Control": "no-cache",
				Accept: "application/json"
			},
			logContext: "weatherprovider.weatherflow"
		}, (data) => {
			const processed = this.#processData(data);
			this.onDataCallback(processed);
		});
	}

	#getUrl () {
		const base = this.config.apiBase || "https://swd.weatherflow.com/swd/rest/";
		return `${base}better_forecast?station_id=${this.config.stationid}&units_temp=c&units_wind=kph&units_pressure=mb&units_precip=mm&units_distance=km&token=${this.config.token}`;
	}

	#processData (data) {
		try {
			let weatherData;
			if (this.config.type === "current") {
				weatherData = this.#generateCurrent(data);
			} else if (this.config.type === "hourly") {
				weatherData = this.#generateHourly(data);
			} else {
				weatherData = this.#generateDaily(data);
			}

			return weatherData;
		} catch (error) {
			Log.error("[weatherflow] Data processing error:", error);
			if (this.onErrorCallback) {
				this.onErrorCallback({
					message: "Failed to process weather data",
					translationKey: "MODULE_ERROR_UNSPECIFIED"
				});
			}
			return null;
		}
	}

	#generateCurrent (data) {
		if (!data || !data.current_conditions || !data.forecast || !Array.isArray(data.forecast.daily) || data.forecast.daily.length === 0) {
			Log.error("[weatherflow] Invalid current weather data structure");
			return null;
		}

		const current = data.current_conditions;
		const daily = data.forecast.daily[0];

		const weather = {
			date: new Date(),
			humidity: current.relative_humidity ?? null,
			temperature: current.air_temperature ?? null,
			feelsLikeTemp: current.feels_like ?? null,
			windSpeed: current.wind_avg != null ? convertKmhToMs(current.wind_avg) : null,
			windFromDirection: current.wind_direction ?? null,
			weatherType: this.#convertWeatherType(current.icon),
			precipitationAmount: current.precip_accum_local_day ?? null,
			precipitationUnits: "mm",
			precipitationProbability: current.precip_probability ?? null,
			uvIndex: current.uv || null,
			sunrise: daily.sunrise ? new Date(daily.sunrise * 1000) : null,
			sunset: daily.sunset ? new Date(daily.sunset * 1000) : null
		};

		return weather;
	}

	#generateDaily (data) {
		if (!data || !data.forecast || !Array.isArray(data.forecast.daily) || !Array.isArray(data.forecast.hourly)) {
			Log.error("[weatherflow] Invalid forecast data structure");
			return [];
		}

		const days = [];

		for (const forecast of data.forecast.daily) {
			const weather = {
				date: new Date(forecast.day_start_local * 1000),
				minTemperature: forecast.air_temp_low ?? null,
				maxTemperature: forecast.air_temp_high ?? null,
				precipitationProbability: forecast.precip_probability ?? null,
				weatherType: this.#convertWeatherType(forecast.icon),
				precipitationAmount: 0.0,
				precipitationUnits: "mm",
				uvIndex: 0
			};

			for (const hour of data.forecast.hourly) {
				const hourDate = new Date(hour.time * 1000);
				const forecastDate = new Date(forecast.day_start_local * 1000);

				if (hourDate.getFullYear() === forecastDate.getFullYear()
				  && hourDate.getMonth() === forecastDate.getMonth()
				  && hourDate.getDate() === forecastDate.getDate()) {
					weather.uvIndex = Math.max(weather.uvIndex, hour.uv ?? 0);
					weather.precipitationAmount += hour.precip ?? 0;
				} else if (hourDate > forecastDate) {
					const diffMs = hourDate - forecastDate;
					if (diffMs >= 86400000) break;
				}
			}

			days.push(weather);
		}

		return days;
	}

	#generateHourly (data) {
		if (!data || !data.forecast || !Array.isArray(data.forecast.hourly)) {
			Log.error("[weatherflow] Invalid hourly data structure");
			return [];
		}

		const hours = [];

		for (const hour of data.forecast.hourly) {
			const weather = {
				date: new Date(hour.time * 1000),
				temperature: hour.air_temperature ?? null,
				feelsLikeTemp: hour.feels_like ?? null,
				humidity: hour.relative_humidity ?? null,
				windSpeed: hour.wind_avg != null ? convertKmhToMs(hour.wind_avg) : null,
				windFromDirection: hour.wind_direction ?? null,
				weatherType: this.#convertWeatherType(hour.icon),
				precipitationProbability: hour.precip_probability ?? null,
				precipitationAmount: hour.precip ?? 0,
				precipitationUnits: "mm",
				uvIndex: hour.uv || null
			};

			hours.push(weather);

			if (hours.length >= 48) break;
		}

		return hours;
	}

	#convertWeatherType (weatherType) {
		const weatherTypes = {
			"clear-day": "day-sunny",
			"clear-night": "night-clear",
			cloudy: "cloudy",
			foggy: "fog",
			"partly-cloudy-day": "day-cloudy",
			"partly-cloudy-night": "night-alt-cloudy",
			"possibly-rainy-day": "day-rain",
			"possibly-rainy-night": "night-alt-rain",
			"possibly-sleet-day": "day-sleet",
			"possibly-sleet-night": "night-alt-sleet",
			"possibly-snow-day": "day-snow",
			"possibly-snow-night": "night-alt-snow",
			"possibly-thunderstorm-day": "day-thunderstorm",
			"possibly-thunderstorm-night": "night-alt-thunderstorm",
			rainy: "rain",
			sleet: "sleet",
			snow: "snow",
			thunderstorm: "thunderstorm",
			windy: "strong-wind"
		};

		return weatherTypes[weatherType] || null;
	}

}

module.exports = WeatherFlowProvider;
