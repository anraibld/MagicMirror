const { expect } = require("playwright/test");
const helpers = require("./helpers/global-setup");

describe("AnimateCSS integration Test", () => {
	let page;

	const TEST_CONFIG_ANIM = "tests/configs/modules/compliments/compliments_animateCSS.js";
	const TEST_CONFIG_FALLBACK = "tests/configs/modules/compliments/compliments_animateCSS_fallbackToDefault.js";
	const TEST_CONFIG_INVERTED = "tests/configs/modules/compliments/compliments_animateCSS_invertedAnimationName.js";
	const TEST_CONFIG_NONE = "tests/configs/modules/compliments/compliments_anytime.js";

	const getComplimentsElement = async () => {
		await helpers.getDocument();
		page = helpers.getPage();
		await expect(page.locator(".compliments")).toBeVisible();
	};

	const waitForAnimationClass = async (cls, { timeout = 6000 } = {}) => {
		const locator = page.locator(`.compliments.animate__animated.${cls}`);
		await locator.waitFor({ state: "attached", timeout });
		await new Promise((r) => setTimeout(r, 50));
		await expect(locator).toBeAttached();
	};

	const assertNoAnimationWithin = async (ms = 2000) => {
		const start = Date.now();
		const locator = page.locator(".compliments.animate__animated");
		while (Date.now() - start < ms) {
			const count = await locator.count();
			if (count > 0) {
				throw new Error("Unexpected animate__animated class present in non-animation scenario");
			}
			await new Promise((r) => setTimeout(r, 100));
		}
	};

	const runAnimationTest = async (animationIn, animationOut) => {
		await getComplimentsElement();
		if (!animationIn && !animationOut) {
			await assertNoAnimationWithin(2000);
			return;
		}
		if (animationIn) await waitForAnimationClass(`animate__${animationIn}`);
		if (animationOut) {
			await new Promise((r) => setTimeout(r, 2100));
			await waitForAnimationClass(`animate__${animationOut}`);
		}
	};

	afterEach(async () => {
		await helpers.stopApplication();
	});

	describe("animateIn and animateOut Test", () => {
		it("with flipInX and flipOutX animation", async () => {
			await helpers.startApplication(TEST_CONFIG_ANIM);
			await runAnimationTest("flipInX", "flipOutX");
		});
	});

	describe("use animateOut name for animateIn (vice versa) Test", () => {
		it("without animation (inverted names)", async () => {
			await helpers.startApplication(TEST_CONFIG_INVERTED);
			await runAnimationTest();
		});
	});

	describe("false Animation name test", () => {
		it("without animation (invalid names)", async () => {
			await helpers.startApplication(TEST_CONFIG_FALLBACK);
			await runAnimationTest();
		});
	});

	describe("no Animation defined test", () => {
		it("without animation (no config)", async () => {
			await helpers.startApplication(TEST_CONFIG_NONE);
			await runAnimationTest();
		});
	});
});
