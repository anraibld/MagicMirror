
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const indexHTML = fs.readFileSync(path.join(__dirname, "../../../../../mocks/weather_envcanada_index.html"), "utf-8");
const cityPageXML = fs.readFileSync(path.join(__dirname, "../../../../../mocks/weather_envcanada.xml"), "utf-8");

const ENVCANADA_INDEX_PATTERN = /https:\/\/dd\.weather\.gc\.ca\/today\/citypage_weather\/[A-Z]{2}\/\d{2}\/$/;
const ENVCANADA_CITYPAGE_PATTERN = /https:\/\/dd\.weather\.gc\.ca\/today\/citypage_weather\/[A-Z]{2}\/\d{2}\/.*\.xml$/;

let server;

beforeAll(() => {
	server = setupServer(
		http.get(ENVCANADA_INDEX_PATTERN, () => {
			return new HttpResponse(indexHTML, {
				headers: { "Content-Type": "text/html" }
			});
		}),
		http.get(ENVCANADA_CITYPAGE_PATTERN, () => {
			return new HttpResponse(cityPageXML, {
				headers: { "Content-Type": "application/xml" }
			});
		})
	);
	server.listen({ onUnhandledRequest: "bypass" });
});

afterAll(() => {
	server.close();
});

afterEach(() => {
	server.resetHandlers();
});

describe("EnvCanadaProvider", () => {
	let EnvCanadaProvider;

	beforeAll(async () => {
		const module = await import("../../../../../../defaultmodules/weather/providers/envcanada");
		EnvCanadaProvider = module.default || module;
	});

	describe("Constructor & Configuration", () => {
		it("should set config values from params", () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "current"
			});
			expect(provider.config.siteCode).toBe("s0000458");
			expect(provider.config.provCode).toBe("ON");
			expect(provider.config.type).toBe("current");
		});

		it("should throw error if siteCode or provCode missing", () => {
			const provider = new EnvCanadaProvider({ siteCode: "", provCode: "" });
			provider.setCallbacks(vi.fn(), vi.fn());
			expect(() => provider.initialize()).toThrow("siteCode and provCode are required");
		});
	});

	describe("Two-Step Fetch Pattern", () => {
		it("should first fetch index page then city page", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;
			expect(result).toBeDefined();
		});
	});

	describe("Current Weather Parsing", () => {
		it("should parse current weather from XML", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "current"
			});

			const dataPromise = new Promise((resolve, reject) => {
				provider.setCallbacks(
					(data) => {
						resolve(data);
					},
					(error) => {
						reject(error);
					}
				);
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result).toBeDefined();
			expect(result.temperature).toBe(-20.3);
			expect(result.windSpeed).toBeCloseTo(5.28, 1);
			expect(result.windFromDirection).toBe(346);
			expect(result.humidity).toBe(67);
		});

		it("should use wind chill for feels like temperature when available", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result.feelsLikeTemp).toBe(-31);
		});

		it("should parse sunrise/sunset from XML", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result.sunrise).toBeInstanceOf(Date);
			expect(result.sunset).toBeInstanceOf(Date);
		});

		it("should convert icon code to weather type", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "current"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result.weatherType).toBe("snow-wind");
		});
	});

	describe("Forecast Parsing", () => {
		it("should parse daily forecast from XML", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(Array.isArray(result)).toBe(true);
			expect(result.length).toBeGreaterThan(0);

			const day = result[0];
			expect(day).toHaveProperty("date");
			expect(day).toHaveProperty("minTemperature");
			expect(day).toHaveProperty("maxTemperature");
			expect(day).toHaveProperty("precipitationProbability");
			expect(day).toHaveProperty("weatherType");
		});

		it("should extract max precipitation probability from day/night", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "forecast"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(result[0].precipitationProbability).toBe(40);
		});
	});

	describe("Hourly Parsing", () => {
		it("should parse hourly forecast from XML", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "hourly"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			expect(Array.isArray(result)).toBe(true);
			expect(result).toHaveLength(24);
			const hour = result[0];
			expect(hour).toHaveProperty("date");
			expect(hour).toHaveProperty("temperature");
			expect(hour).toHaveProperty("precipitationProbability");
			expect(hour).toHaveProperty("weatherType");
		});

		it("should parse EC time format correctly", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s0000458",
				provCode: "ON",
				type: "hourly"
			});

			const dataPromise = new Promise((resolve) => {
				provider.setCallbacks(resolve, vi.fn());
			});

			await provider.initialize();
			provider.start();

			const result = await dataPromise;

			const expectedDate = new Date(Date.UTC(2026, 1, 7, 13, 0, 0));
			expect(result[0].date.getTime()).toBe(expectedDate.getTime());
		});
	});

	describe("Error Handling", () => {
		it("should handle missing city page URL", async () => {
			const provider = new EnvCanadaProvider({
				siteCode: "s9999999",
				provCode: "ON",
				type: "current"
			});

			let errorCalled = false;
			provider.setCallbacks(vi.fn(), () => {
				errorCalled = true;
			});

			await provider.initialize();
			provider.start();

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(errorCalled).toBe(false);
		});
	});
});
