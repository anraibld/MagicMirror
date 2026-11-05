import {defineConfig} from "vitest/config";

export default defineConfig({
	test: {
		globals: true,
		environment: "node",
		setupFiles: ["./tests/utils/vitest-setup.js"],
		bail: 3,
		restoreAllMocks: true,

		exclude: [
			"**/node_modules/**",
			"**/dist/**",
			"tests/unit/mocks/**",
			"tests/unit/helpers/**",
			"tests/electron/helpers/**",
			"tests/e2e/helpers/**",
			"tests/e2e/mocks/**",
			"tests/configs/**",
			"tests/utils/**"
		],

		projects: [
			{
				test: {
					name: "unit",
					globals: true,
					environment: "node",
					setupFiles: ["./tests/utils/vitest-setup.js"],
					include: [
						"tests/unit/**/*_spec.js",
						"tests/unit/defaultmodules/calendar/calendar_fetcher_utils_bad_rrule.js"
					],
					testTimeout: 20000,
					hookTimeout: 10000
				}
			},
			{
				test: {
					name: "e2e",
					globals: true,
					environment: "node",
					setupFiles: ["./tests/utils/vitest-setup.js"],
					include: ["tests/e2e/**/*_spec.js"],
					testTimeout: 60000,
					hookTimeout: 30000
				}
			},
			{
				test: {
					name: "electron",
					globals: true,
					environment: "node",
					setupFiles: ["./tests/utils/vitest-setup.js"],
					include: ["tests/electron/**/*_spec.js"],
					testTimeout: 120000,
					hookTimeout: 30000
				}
			}
		],

		coverage: {
			provider: "v8",
			reporter: ["lcov", "text"],
			include: [
				"clientonly/**/*.js",
				"js/**/*.js",
				"defaultmodules/**/*.js",
				"serveronly/**/*.js"
			],
			exclude: [
				"**/node_modules/**",
				"**/tests/**",
				"**/dist/**"
			]
		},

		pool: "forks",
		maxWorkers: 1,
		isolate: true
	}
});
