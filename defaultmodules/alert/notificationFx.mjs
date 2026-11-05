
const extend = (target, source) => {
	for (const key in source) {
		if (Object.hasOwn(source, key)) {
			target[key] = source[key];
		}
	}
	return target;
};

export class NotificationFx {

	static defaultOptions = {

		wrapper: document.body,
		message: "yo!",
		layout: "growl",

		effect: "slide",

		type: "notice",

		ttl: 6000,
		boxClassName: "ns-box",
		onClose () {
			return false;
		},
		onOpen () {
			return false;
		}
	};

	constructor (options) {
		this.options = extend({}, NotificationFx.defaultOptions);
		extend(this.options, options);
		this.#init();
	}

	#init () {
		this.ntf = document.createElement("div");
		this.ntf.className = `${this.options.boxClassName} ns-${this.options.layout} ns-effect-${this.options.effect} ns-type-${this.options.type}`;
		let strinner = "<div class=\"ns-box-inner\">";
		strinner += this.options.message;
		strinner += "</div>";
		this.ntf.innerHTML = strinner;

		this.options.wrapper.insertBefore(this.ntf, this.options.wrapper.nextSibling);

		if (this.options.ttl) {
			this.dismissttl = setTimeout(() => {
				if (this.active) {
					this.dismiss();
				}
			},
			this.options.ttl);
		}

		this.#initEvents();
	}

	#initEvents () {
		this.ntf.querySelector(".ns-box-inner").addEventListener("click", () => {
			this.dismiss();
		});
	}

	show () {
		this.active = true;
		this.ntf.classList.remove("ns-hide");
		this.ntf.classList.add("ns-show");
		this.options.onOpen();
	}

	dismiss (close = true) {
		this.active = false;
		clearTimeout(this.dismissttl);
		this.ntf.classList.remove("ns-show");
		setTimeout(() => {
			this.ntf.classList.add("ns-hide");

			if (close) {
				this.options.onClose();
			}
		},
		25);

		const onEndAnimationFn = (ev) => {
			if (ev.target === this.ntf) {
				this.ntf.removeEventListener("animationend", onEndAnimationFn);

				if (ev.target.parentNode === this.options.wrapper) {
					this.options.wrapper.removeChild(this.ntf);
				}
			}
		};

		this.ntf.addEventListener("animationend", onEndAnimationFn);
	}
}

globalThis.NotificationFx = NotificationFx;
