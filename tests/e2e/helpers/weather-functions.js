const fs = require("node:fs");
const path = require("node:path");
const weatherUtils = require("../../../defaultmodules/weather/provider-utils");
const helpers = require("./global-setup");

const injectMockWeatherData = async (page, mockDataFile) => {
	const rawData = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../mocks", mockDataFile)).toString());

	if (!rawData.current && !rawData.daily && !rawData.hourly) {
		throw new Error(
			"Invalid weather fixture: missing current, daily, and hourly data. "
			+ `Available keys: ${Object.keys(rawData).join(", ")}`
		);
	}

	let type = "current";
	let data = null;

	const timezoneOffset = rawData.timezone_offset ? rawData.timezone_offset / 60 : 0;

	if (rawData.current) {
		type = "current";
		data = {
			date: weatherUtils.applyTimezoneOffset(new Date(rawData.current.dt * 1000), timezoneOffset),
			windSpeed: rawData.current.wind_speed,
			windFromDirection: rawData.current.wind_deg,
			sunrise: weatherUtils.applyTimezoneOffset(new Date(rawData.current.sunrise * 1000), timezoneOffset),
			sunset: weatherUtils.applyTimezoneOffset(new Date(rawData.current.sunset * 1000), timezoneOffset),
			temperature: rawData.current.temp,
			weatherType: weatherUtils.convertWeatherType(rawData.current.weather[0].icon),
			humidity: rawData.current.humidity,
			feelsLikeTemp: rawData.current.feels_like
		};
	} else if (rawData.daily) {
		type = "forecast";
		data = rawData.daily.map((day) => ({
			date: weatherUtils.applyTimezoneOffset(new Date(day.dt * 1000), timezoneOffset),
			minTemperature: day.temp.min,
			maxTemperature: day.temp.max,
			weatherType: weatherUtils.convertWeatherType(day.weather[0].icon),
			rain: day.rain || 0,
			snow: day.snow || 0,
			precipitationAmount: (day.rain || 0) + (day.snow || 0)
		}));
	} else if (rawData.hourly) {
		type = "hourly";
		data = rawData.hourly.map((hour) => ({
			date: weatherUtils.applyTimezoneOffset(new Date(hour.dt * 1000), timezoneOffset),
			temperature: hour.temp,
			feelsLikeTemp: hour.feels_like,
			humidity: hour.humidity,
			windSpeed: hour.wind_speed,
			windFromDirection: hour.wind_deg,
			weatherType: weatherUtils.convertWeatherType(hour.weather[0].icon),
			precipitationProbability: hour.pop != null ? hour.pop * 100 : undefined,
			precipitationAmount: (hour.rain?.["1h"] || 0) + (hour.snow?.["1h"] || 0)
		}));
	}

	await page.evaluate(({ type, data }) => {
		const weatherModule = MM.getModules().find((m) => m.name === "weather");
		if (weatherModule) {
			weatherModule.socketNotificationReceived("WEATHER_INITIALIZED", {
				instanceId: weatherModule.instanceId,
				locationName: "Munich"
			});
			weatherModule.socketNotificationReceived("WEATHER_DATA", {
				instanceId: weatherModule.instanceId,
				type: type,
				data: data
			});
		}
	}, { type, data });
};

exports.startApplication = async (configFileName, mockDataFile) => {
	await helpers.startApplication(configFileName);
	await helpers.getDocument();

	if (mockDataFile) {
		const page = helpers.getPage();
		await page.waitForSelector(".weather", { timeout: 5000 });
		await injectMockWeatherData(page, mockDataFile);
		await page.waitForSelector(".weather .weathericon", { timeout: 2000 });
	}
};

exports.stopApplication = async () => {
	await helpers.stopApplication();
};
