import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

import onecallData from "../../../../../mocks/weather_owm_onecall.json" with { type: "json" };
import currentData from "../../../../../mocks/weather_owm_current.json" with { type: "json" };
import forecastData from "../../../../../mocks/weather_owm_forecast.json" with { type: "json" };

let server;

beforeAll(() => {
	server = setupServer();
	server.listen({ onUnhandledRequest: "bypass" });
});

afterAll(() => {
	server.close();
});

afterEach(() => {
	server.resetHandlers();
});

describe("OpenWeatherMapProvider", () => {
	let OpenWeatherMapProvider;

	beforeAll(async () => {
		const module = await import("../../../../../../defaultmodules/weather/providers/openweathermap");
		OpenWeatherMapProvider = module.default;
	});

	describe("Constructor & Configuration", () => {
		it("should set config values from params", () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key"
			});
			expect(provider.config.lat).toBe(48.14);
			expect(provider.config.lon).toBe(11.58);
			expect(provider.config.apiKey).toBe("test-key");
		});

		it("should have default values", () => {
			const provider = new OpenWeatherMapProvider({ apiKey: "test" });
			expect(provider.config.apiVersion).toBe("3.0");
			expect(provider.config.weatherEndpoint).toBe("/onecall");
			expect(provider.config.apiBase).toBe("https://api.openweathermap.org/data/");
		});
	});

	describe("API Key Validation", () => {
		it("should call error callback without API key", async () => {
			const provider = new OpenWeatherMapProvider({ apiKey: "" });
			const onError = vi.fn();
			provider.setCallbacks(vi.fn(), onError);
			await provider.initialize();
			expect(onError).toHaveBeenCalledWith(
				expect.objectContaining({ message: "API key is required" })
			);
		});

		it("should not create fetcher without API key", async () => {
			const provider = new OpenWeatherMapProvider({ apiKey: "" });
			provider.setCallbacks(vi.fn(), vi.fn());
			await provider.initialize();
			expect(provider.fetcher).toBeNull();
		});

		it("should throw if setCallbacks not called before initialize", () => {
			const provider = new OpenWeatherMapProvider({ apiKey: "test" });
			expect(() => provider.initialize()).toThrow("setCallbacks");
		});
	});

	describe("Current Weather Parsing", () => {
		it("should parse onecall current weather data", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/3.0/onecall", () => {
					return HttpResponse.json(onecallData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result.temperature).toBe(-0.27);
			expect(result.windSpeed).toBe(3.09);
			expect(result.windFromDirection).toBe(220);
			expect(result.humidity).toBe(54);
			expect(result.uvIndex).toBe(0);
			expect(result.feelsLikeTemp).toBe(-3.9);
			expect(result.weatherType).toBe("cloudy-windy");
			expect(result.sunrise).toBeInstanceOf(Date);
			expect(result.sunset).toBeInstanceOf(Date);
		});

		it("should include precipitation data in current weather", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/3.0/onecall", () => {
					return HttpResponse.json(onecallData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result.rain).toBeUndefined();
			expect(result.snow).toBeUndefined();
		});
	});

	describe("Forecast Parsing", () => {
		it("should parse daily forecast data", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/3.0/onecall", () => {
					return HttpResponse.json(onecallData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(8);
			expect(result[0].minTemperature).toBe(-11.86);
			expect(result[0].maxTemperature).toBe(-0.27);
			expect(result[0].snow).toBe(0.69);
			expect(result[0].precipitationProbability).toBe(100);
		});
	});

	describe("Hourly Parsing", () => {
		it("should parse hourly forecast data", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				type: "hourly"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/3.0/onecall", () => {
					return HttpResponse.json(onecallData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(48);
			expect(result[0].temperature).toBe(-0.66);
			expect(result[0].precipitationProbability).toBe(0);
			expect(result[0].rain).toBeUndefined();
		});
	});

	describe("Timezone Handling", () => {
		it("should set location name from timezone", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/3.0/onecall", () => {
					return HttpResponse.json(onecallData);
				})
			);

			await provider.initialize();
			provider.start();

			await dataPromise;

			expect(provider.locationName).toBe("America/New_York");
		});
	});

	describe("API v2.5 - Current Weather (/weather endpoint)", () => {
		it("should parse current weather from /weather endpoint", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/weather",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/weather", () => {
					return HttpResponse.json(currentData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result.temperature).toBe(-0.27);
			expect(result.feelsLikeTemp).toBe(-3.9);
			expect(result.humidity).toBe(54);
			expect(result.windSpeed).toBe(3.09);
			expect(result.windFromDirection).toBe(220);
			expect(result.weatherType).toBe("cloudy-windy");
			expect(result.sunrise).toBeInstanceOf(Date);
			expect(result.sunset).toBeInstanceOf(Date);
		});

		it("should set location name from city name and country", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/weather",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/weather", () => {
					return HttpResponse.json(currentData);
				})
			);

			await provider.initialize();
			provider.start();

			await dataPromise;

			expect(provider.locationName).toBe("Munich, DE");
		});
	});

	describe("API v2.5 - Forecast (/forecast endpoint)", () => {
		it("should parse /forecast endpoint into daily grouped forecast", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(2);
		});

		it("should correctly aggregate min/max temperatures per day", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result[0].minTemperature).toBe(-1.5);
			expect(result[0].maxTemperature).toBe(2.5);
			expect(result[1].minTemperature).toBe(0.0);
			expect(result[1].maxTemperature).toBe(5.5);
		});

		it("should pick daytime weather type (8-17h)", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result[0].weatherType).toBe("rain");
			expect(result[1].weatherType).toBe("showers");
		});

		it("should accumulate precipitation per day", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result[0].rain).toBeCloseTo(1.2);
			expect(result[0].precipitationAmount).toBeCloseTo(1.2);
			expect(result[1].snow).toBeCloseTo(0.5);
			expect(result[1].precipitationAmount).toBeCloseTo(0.5);
		});

		it("should set location name from city in forecast response", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			await dataPromise;

			expect(provider.locationName).toBe("Munich, DE");
		});
	});

	describe("API v2.5 - Hourly (/forecast endpoint with type hourly)", () => {
		it("should return individual 3h entries instead of aggregating", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "hourly"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(forecastData.list.length);
		});

		it("should map temperature and wind from each 3h slot", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "hourly"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result[0].temperature).toBe(forecastData.list[0].main.temp);
			expect(result[0].windSpeed).toBe(forecastData.list[0].wind.speed);
			expect(result[0].precipitationProbability).toBe(forecastData.list[0].pop * 100);
		});

		it("should include precipitation when present in a slot", async () => {
			const provider = new OpenWeatherMapProvider({
				lat: 48.14,
				lon: 11.58,
				apiKey: "test-key",
				apiVersion: "2.5",
				weatherEndpoint: "/forecast",
				type: "hourly"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			server.use(
				http.get("https://api.openweathermap.org/data/2.5/forecast", () => {
					return HttpResponse.json(forecastData);
				})
			);

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result[3].rain).toBe(0.6);
			expect(result[3].precipitationAmount).toBe(0.6);
			expect(result[11].snow).toBe(0.5);
			expect(result[11].precipitationAmount).toBe(0.5);
		});
	});
});
