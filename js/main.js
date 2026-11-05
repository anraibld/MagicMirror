import "./module.js";
import "../defaultmodules/utils.js";
import "./positions.js";
import { AnimateCSSIn, AnimateCSSOut, addAnimateCSS, removeAnimateCSS } from "./animateCSS.js";
import { loadModules } from "./loader.js";
import { io } from "./socketclient.js";
import { Translator } from "./translator.js";

let modules = [];

const createDomObjects = async () => {
	const domCreationPromises = [];

	modules.forEach((module) => {
		if (typeof module.data.position !== "string") {
			return;
		}

		let haveAnimateIn = null;
		if (module.data.animateIn && AnimateCSSIn.indexOf(module.data.animateIn) !== -1) haveAnimateIn = module.data.animateIn;

		const wrapper = selectWrapper(module.data.position);

		const dom = document.createElement("div");
		dom.id = module.identifier;
		dom.className = module.name;

		if (typeof module.data.classes === "string") {
			dom.className = `module ${dom.className} ${module.data.classes}`;
		}

		dom.style.order = (typeof module.data.order === "number" && Number.isInteger(module.data.order)) ? module.data.order : 0;

		dom.opacity = 0;
		wrapper.appendChild(dom);

		const moduleHeader = document.createElement("header");
		moduleHeader.innerHTML = module.getHeader();
		moduleHeader.className = "module-header";
		dom.appendChild(moduleHeader);

		if (typeof module.getHeader() === "undefined" || module.getHeader() !== "") {
			moduleHeader.style.display = "none;";
		} else {
			moduleHeader.style.display = "block;";
		}

		const moduleContent = document.createElement("div");
		moduleContent.className = "module-content";
		dom.appendChild(moduleContent);

		domCreationPromises.push(createModuleDom(module, haveAnimateIn));
	});

	updateWrapperStates();

	try {
		await Promise.all(domCreationPromises);
		_sendNotification("DOM_OBJECTS_CREATED");
	} catch (error) {
		Log.error(error);
	}
};

const createModuleDom = async (module, haveAnimateIn) => {
	if (haveAnimateIn) {
		await _updateDom(module, { options: { speed: 1000, animate: { in: haveAnimateIn } } }, true);
	} else {
		await _updateDom(module, 0);
	}

	_sendNotification("MODULE_DOM_CREATED", null, null, module);
};

const selectWrapper = (position) => {
	const classes = position.replace("_", " ");
	const parentWrapper = document.getElementsByClassName(classes);
	if (parentWrapper.length > 0) {
		const wrapper = parentWrapper[0].getElementsByClassName("container");
		if (wrapper.length > 0) {
			return wrapper[0];
		}
	}
};

const _sendNotification = (notification, payload, sender, sendTo) => {
	for (const m in modules) {
		const module = modules[m];
		if (module !== sender && (!sendTo || module === sendTo)) {
			module.notificationReceived(notification, payload, sender);
		}
	}
};

const _updateDom = async (module, updateOptions, createAnimatedDom = false) => {
	let speed = updateOptions;
	let animateOut = null;
	let animateIn = null;
	if (typeof updateOptions === "object") {
		if (typeof updateOptions.options === "object" && updateOptions.options.speed !== undefined) {
			speed = updateOptions.options.speed;
			Log.debug(`updateDom: ${module.identifier} Has speed in object: ${speed}`);
			if (typeof updateOptions.options.animate === "object") {
				animateOut = updateOptions.options.animate.out;
				animateIn = updateOptions.options.animate.in;
				Log.debug(`updateDom: ${module.identifier} Has animate in object: out->${animateOut}, in->${animateIn}`);
			}
		} else {
			Log.debug(`updateDom: ${module.identifier} Has no speed in object`);
			speed = 0;
		}
	}

	const newHeader = module.getHeader();
	const newContent = await module.getDom();
	await updateDomWithContent(module, speed, newHeader, newContent, animateOut, animateIn, createAnimatedDom);
};

const updateDomWithContent = async (module, speed, newHeader, newContent, animateOut, animateIn, createAnimatedDom = false) => {
	if (module.hidden || !speed) {
		updateModuleContent(module, newHeader, newContent);
		return;
	}

	if (!moduleNeedsUpdate(module, newHeader, newContent)) {
		return;
	}

	if (createAnimatedDom && animateIn !== null) {
		Log.debug(`${module.identifier} createAnimatedDom (${animateIn})`);
		updateModuleContent(module, newHeader, newContent);
		if (!module.hidden) {
			_showModule(module, speed, null, { animate: animateIn });
		}
		return;
	}

	await new Promise((resolve) => _hideModule(module, speed / 2, resolve, { animate: animateOut }));
	updateModuleContent(module, newHeader, newContent);
	if (!module.hidden) {
		await new Promise((resolve) => _showModule(module, speed / 2, resolve, { animate: animateIn }));
	}
};

const moduleNeedsUpdate = (module, newHeader, newContent) => {
	const moduleWrapper = document.getElementById(module.identifier);
	if (moduleWrapper === null) {
		return false;
	}

	const contentWrapper = moduleWrapper.getElementsByClassName("module-content");
	const headerWrapper = moduleWrapper.getElementsByClassName("module-header");

	let headerNeedsUpdate = false;

	if (headerWrapper.length > 0) {
		headerNeedsUpdate = newHeader !== headerWrapper[0].innerHTML;
	}

	const tempContentWrapper = document.createElement("div");
	tempContentWrapper.appendChild(newContent);
	const contentNeedsUpdate = tempContentWrapper.innerHTML !== contentWrapper[0].innerHTML;

	return headerNeedsUpdate || contentNeedsUpdate;
};

const updateModuleContent = (module, newHeader, newContent) => {
	const moduleWrapper = document.getElementById(module.identifier);
	if (moduleWrapper === null) {
		return;
	}
	const headerWrapper = moduleWrapper.getElementsByClassName("module-header");
	const contentWrapper = moduleWrapper.getElementsByClassName("module-content");

	contentWrapper[0].innerHTML = "";
	contentWrapper[0].appendChild(newContent);

	headerWrapper[0].innerHTML = newHeader;
	if (headerWrapper.length > 0 && newHeader) {
		headerWrapper[0].style.display = "block";
	} else {
		headerWrapper[0].style.display = "none";
	}
};

const _hideModule = (module, speed, callback, options = {}) => {
	if (options.lockString) {
		if (module.lockStrings.indexOf(options.lockString) === -1) {
			module.lockStrings.push(options.lockString);
		}
	}

	const moduleWrapper = document.getElementById(module.identifier);
	if (moduleWrapper !== null) {
		clearTimeout(module.showHideTimer);
		if (module.hasAnimateOut) {
			removeAnimateCSS(module.identifier, module.hasAnimateOut);
			Log.debug(`${module.identifier} Force remove animateOut (in hide): ${module.hasAnimateOut}`);
			module.hasAnimateOut = false;
		}
		if (module.hasAnimateIn) {
			removeAnimateCSS(module.identifier, module.hasAnimateIn);
			Log.debug(`${module.identifier} Force remove animateIn (in hide): ${module.hasAnimateIn}`);
			module.hasAnimateIn = false;
		}
		let haveAnimateName = null;
		if (module.data.animateOut && AnimateCSSOut.indexOf(module.data.animateOut) !== -1) haveAnimateName = module.data.animateOut;
		else if (options.animate && AnimateCSSOut.indexOf(options.animate) !== -1) haveAnimateName = options.animate;

		if (haveAnimateName) {
			Log.debug(`${module.identifier} Has animateOut: ${haveAnimateName}`);
			module.hasAnimateOut = haveAnimateName;
			addAnimateCSS(module.identifier, haveAnimateName, speed / 1000);
			module.showHideTimer = setTimeout(() => {
				removeAnimateCSS(module.identifier, haveAnimateName);
				Log.debug(`${module.identifier} Remove animateOut: ${module.hasAnimateOut}`);
				moduleWrapper.style.opacity = 0;
				moduleWrapper.classList.add("hidden");
				moduleWrapper.style.position = "fixed";
				module.hasAnimateOut = false;

				updateWrapperStates();
				if (typeof callback === "function") {
					callback();
				}
			}, speed);
		} else {
			moduleWrapper.style.transition = `opacity ${speed / 1000}s`;
			moduleWrapper.style.opacity = 0;
			moduleWrapper.classList.add("hidden");
			module.showHideTimer = setTimeout(() => {
				moduleWrapper.style.position = "fixed";

				updateWrapperStates();

				if (typeof callback === "function") {
					callback();
				}
			}, speed);
		}
	} else {
		if (typeof callback === "function") {
			callback();
		}
	}
};

const _showModule = (module, speed, callback, options = {}) => {
	if (options.lockString) {
		const index = module.lockStrings.indexOf(options.lockString);
		if (index !== -1) {
			module.lockStrings.splice(index, 1);
		}
	}

	if (module.lockStrings.length !== 0 && options.force !== true) {
		Log.log(`Will not show ${module.name}. LockStrings active: ${module.lockStrings.join(",")}`);
		if (typeof options.onError === "function") {
			options.onError(new Error("LOCK_STRING_ACTIVE"));
		}
		return;
	}
	if (module.hasAnimateOut) {
		removeAnimateCSS(module.identifier, module.hasAnimateOut);
		Log.debug(`${module.identifier} Force remove animateOut (in show): ${module.hasAnimateOut}`);
		module.hasAnimateOut = false;
	}
	if (module.hasAnimateIn) {
		removeAnimateCSS(module.identifier, module.hasAnimateIn);
		Log.debug(`${module.identifier} Force remove animateIn (in show): ${module.hasAnimateIn}`);
		module.hasAnimateIn = false;
	}

	module.hidden = false;

	if (module.lockStrings.length !== 0 && options.force === true) {
		Log.log(`Force show of module: ${module.name}`);
		module.lockStrings = [];
	}

	const moduleWrapper = document.getElementById(module.identifier);
	if (moduleWrapper !== null) {
		clearTimeout(module.showHideTimer);

		let haveAnimateName = null;
		if (module.data.animateIn && AnimateCSSIn.indexOf(module.data.animateIn) !== -1) haveAnimateName = module.data.animateIn;
		else if (options.animate && AnimateCSSIn.indexOf(options.animate) !== -1) haveAnimateName = options.animate;

		if (!haveAnimateName) moduleWrapper.style.transition = `opacity ${speed / 1000}s`;
		moduleWrapper.style.position = "static";
		moduleWrapper.classList.remove("hidden");

		updateWrapperStates();

		void moduleWrapper.parentElement.parentElement.offsetHeight;
		moduleWrapper.style.opacity = 1;

		if (haveAnimateName) {
			Log.debug(`${module.identifier} Has animateIn: ${haveAnimateName}`);
			module.hasAnimateIn = haveAnimateName;
			addAnimateCSS(module.identifier, haveAnimateName, speed / 1000);
			module.showHideTimer = setTimeout(() => {
				removeAnimateCSS(module.identifier, haveAnimateName);
				Log.debug(`${module.identifier} Remove animateIn: ${haveAnimateName}`);
				module.hasAnimateIn = false;
				if (typeof callback === "function") {
					callback();
				}
			}, speed);
		} else {
			module.showHideTimer = setTimeout(() => {
				if (typeof callback === "function") {
					callback();
				}
			}, speed);
		}
	} else {
		if (typeof callback === "function") {
			callback();
		}
	}
};

const updateWrapperStates = () => {
	globalThis.modulePositions.forEach((position) => {
		const wrapper = selectWrapper(position);
		const moduleWrappers = wrapper.getElementsByClassName("module");

		let showWrapper = false;
		Array.prototype.forEach.call(moduleWrappers, (moduleWrapper) => {
			if (moduleWrapper.style.position === "" || moduleWrapper.style.position === "static") {
				showWrapper = true;
			}
		});

		wrapper.className = showWrapper ? "container" : "container hidden";
	});
};

const loadConfig = async () => {
	const basePath = globalThis.config?.basePath ?? "/";
	const res = await fetch(new URL("config/", `${location.origin}${basePath}`));
	if (!res.ok) {
		throw new Error(`Unable to retrieve config: server responded with HTTP ${res.status} ${res.statusText}.`);
	}

	const config = JSON.parse(await res.text(), (key, value) => {
		if (value && typeof value === "object" && typeof value.__mmFunction === "string") {
			try {
				return new Function(`return (${value.__mmFunction})`)();
			} catch {
				Log.warn(`Failed to revive function for config key "${key}".`);
			}
		}
		return value;
	});
	globalThis.config = config;
	return config;
};

const setSelectionMethodsForModules = (modules) => {

	const withClass = (className) => {
		return modulesByClass(className, true);
	};

	const exceptWithClass = (className) => {
		return modulesByClass(className, false);
	};

	const modulesByClass = (className, include) => {
		let searchClasses = className;
		if (typeof className === "string") {
			searchClasses = className.split(" ");
		}

		const newModules = modules.filter((module) => {
			const classes = module.data.classes.toLowerCase().split(" ");

			for (const searchClass of searchClasses) {
				if (classes.indexOf(searchClass.toLowerCase()) !== -1) {
					return include;
				}
			}

			return !include;
		});

		setSelectionMethodsForModules(newModules);
		return newModules;
	};

	const exceptModule = (module) => {
		const newModules = modules.filter((mod) => {
			return mod.identifier !== module.identifier;
		});

		setSelectionMethodsForModules(newModules);
		return newModules;
	};

	const enumerate = (callback) => {
		modules.map((module) => {
			callback(module);
		});
	};

	if (typeof modules.withClass === "undefined") {
		Object.defineProperty(modules, "withClass", { value: withClass, enumerable: false });
	}
	if (typeof modules.exceptWithClass === "undefined") {
		Object.defineProperty(modules, "exceptWithClass", { value: exceptWithClass, enumerable: false });
	}
	if (typeof modules.exceptModule === "undefined") {
		Object.defineProperty(modules, "exceptModule", { value: exceptModule, enumerable: false });
	}
	if (typeof modules.enumerate === "undefined") {
		Object.defineProperty(modules, "enumerate", { value: enumerate, enumerable: false });
	}
};

export const MM = {

	async init () {
		Log.info("Initializing MagicMirror².");
		const config = await loadConfig();
		Log.setLogLevel(config.logLevel);
		await Translator.loadCoreTranslations(config.language);
		await loadModules();
	},

	modulesStarted (moduleObjects) {
		modules = [];
		let startUp = "";

		moduleObjects.forEach((module) => modules.push(module));

		Log.info("All modules started!");
		_sendNotification("ALL_MODULES_STARTED");

		createDomObjects();

		const socket = io("/", {
			path: `${globalThis.config.basePath || "/"}socket.io`
		});

		socket.on("RELOAD", () => {
			Log.warn("Reload notification received from server");
			window.location.reload(true);
		});

		if (globalThis.config.reloadAfterServerRestart) {
			setInterval(async () => {
				try {
					const res = await fetch(`${location.protocol}//${location.host}${globalThis.config.basePath}startup`);
					const curr = await res.text();
					if (startUp === "") startUp = curr;
					if (startUp !== curr) {
						startUp = "";
						window.location.reload(true);
						Log.warn("Refreshing Website because server was restarted");
					}
				} catch (err) {
					Log.error(`MagicMirror not reachable: ${err}`);
				}
			}, globalThis.config.checkServerInterval);
		}
	},

	sendNotification (notification, payload, sender) {
		if (arguments.length < 3) {
			Log.error("sendNotification: Missing arguments.");
			return;
		}

		if (typeof notification !== "string") {
			Log.error("sendNotification: Notification should be a string.");
			return;
		}

		if (!(sender instanceof Module)) {
			Log.error("sendNotification: Sender should be a module.");
			return;
		}

		_sendNotification(notification, payload, sender);
	},

	async updateDom (module, updateOptions) {
		if (!(module instanceof Module)) {
			Log.error("updateDom: Sender should be a module.");
			return;
		}

		if (!module.data.position) {
			Log.warn("module tries to update the DOM without being displayed.");
			return;
		}

		await _updateDom(module, updateOptions);
		_sendNotification("MODULE_DOM_UPDATED", null, null, module);
	},

	getModules () {
		setSelectionMethodsForModules(modules);
		return modules;
	},

	hideModule (module, speed, callback, options) {
		module.hidden = true;
		_hideModule(module, speed, callback, options);
	},

	showModule (module, speed, callback, options) {
		_showModule(module, speed, callback, options);
	},

	getAvailableModulePositions: globalThis.modulePositions
};

if (!globalThis.MM) globalThis.MM = MM;

try {
	await MM.init();
} catch (error) {
	Log.error(error);
}
