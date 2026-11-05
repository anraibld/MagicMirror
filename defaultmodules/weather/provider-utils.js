
const SunCalc = require("suncalc");

const convertWeatherType = (weatherType) => {
	const weatherTypes = {
		"01d": "day-sunny",
		"02d": "day-cloudy",
		"03d": "cloudy",
		"04d": "cloudy-windy",
		"09d": "showers",
		"10d": "rain",
		"11d": "thunderstorm",
		"13d": "snow",
		"50d": "fog",
		"01n": "night-clear",
		"02n": "night-cloudy",
		"03n": "night-cloudy",
		"04n": "night-cloudy",
		"09n": "night-showers",
		"10n": "night-rain",
		"11n": "night-thunderstorm",
		"13n": "night-snow",
		"50n": "night-alt-cloudy-windy"
	};

	return weatherTypes.hasOwnProperty(weatherType) ? weatherTypes[weatherType] : null;
};

const applyTimezoneOffset = (date, offsetMinutes) => {
	const utcTime = date.getTime() + (date.getTimezoneOffset() * 60000);
	return new Date(utcTime + (offsetMinutes * 60000));
};

const limitDecimals = (value, decimals) => {
	const str = value.toString();
	if (str.includes(".")) {
		const parts = str.split(".");
		if (parts[1].length > decimals) {
			return parseFloat(`${parts[0]}.${parts[1].substring(0, decimals)}`);
		}
	}
	return value;
};

const getSunTimes = (date, lat, lon) => {
	const sunTimes = SunCalc.getTimes(date, lat, lon);
	return {
		sunrise: sunTimes.sunrise,
		sunset: sunTimes.sunset
	};
};

const isDayTime = (date, sunrise, sunset) => {
	if (!sunrise || !sunset) {
		return true;
	}
	return date >= sunrise && date < sunset;
};

const formatTimezoneOffset = (offsetMinutes) => {
	const hours = Math.floor(Math.abs(offsetMinutes) / 60);
	const minutes = Math.abs(offsetMinutes) % 60;
	const sign = offsetMinutes >= 0 ? "+" : "-";
	return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
};

const getDateString = (date) => {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
};

const convertKmhToMs = (kmh) => {
	return kmh / 3.6;
};

const cardinalToDegrees = (direction) => {
	const directions = {
		N: 0,
		NNE: 22.5,
		NE: 45,
		ENE: 67.5,
		E: 90,
		ESE: 112.5,
		SE: 135,
		SSE: 157.5,
		S: 180,
		SSW: 202.5,
		SW: 225,
		WSW: 247.5,
		W: 270,
		WNW: 292.5,
		NW: 315,
		NNW: 337.5
	};
	return directions[direction] ?? null;
};

const validateCoordinates = (config, maxDecimals = 4) => {
	if (config.lat == null || config.lon == null
	  || !Number.isFinite(config.lat) || !Number.isFinite(config.lon)) {
		throw new Error("Latitude and longitude are required");
	}

	config.lat = limitDecimals(config.lat, maxDecimals);
	config.lon = limitDecimals(config.lon, maxDecimals);
};

module.exports = {
	convertWeatherType,
	applyTimezoneOffset,
	limitDecimals,
	getSunTimes,
	isDayTime,
	formatTimezoneOffset,
	getDateString,
	convertKmhToMs,
	cardinalToDegrees,
	validateCoordinates
};
