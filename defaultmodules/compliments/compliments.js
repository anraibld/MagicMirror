
Module.register("compliments", {
	defaults: {
		compliments: {
			anytime: ["Hey there sexy!"],
			morning: ["Good morning, handsome!", "Enjoy your day!", "How was your sleep?"],
			afternoon: ["Hello, beauty!", "You look sexy!", "Looking good today!"],
			evening: ["Wow, you look hot!", "You look nice!", "Hi, sexy!"],
			"....-01-01": ["Happy new year!"]
		},
		updateInterval: 30000,
		remoteFile: null,
		remoteFileRefreshInterval: 0,
		fadeSpeed: 4000,
		morningStartTime: 3,
		morningEndTime: 12,
		afternoonStartTime: 12,
		afternoonEndTime: 17,
		random: true,
		specialDayUnique: false
	},
	compliments_new: null,
	refreshMinimumDelay: 15 * 60 * 1000,
	lastIndexUsed: -1,
	currentWeatherType: "",
	cron_regex: /^(((\d+,)+\d+|((\d+|[*])[/]\d+|((JAN|FEB|APR|MA[RY]|JU[LN]|AUG|SEP|OCT|NOV|DEC)(-(JAN|FEB|APR|MA[RY]|JU[LN]|AUG|SEP|OCT|NOV|DEC))?))|(\d+-\d+)|\d+(-\d+)?[/]\d+(-\d+)?|\d+|[*]|(MON|TUE|WED|THU|FRI|SAT|SUN)(-(MON|TUE|WED|THU|FRI|SAT|SUN))?) ?){5}$/i,
	date_regex: "[1-9.][0-9.][0-9.]{2}-([0][1-9]|[1][0-2])-([1-2][0-9]|[0][1-9]|[3][0-1])",
	pre_defined_types: ["anytime", "morning", "afternoon", "evening"],
	getScripts () {
		return ["croner.js", "moment.js"];
	},

	async start () {
		Log.info(`Starting module: ${this.name}`);

		this.lastComplimentIndex = -1;

		if (this.config.remoteFile !== null) {
			const response = await this.loadComplimentFile();
			this.config.compliments = JSON.parse(response);
			this.updateDom();
			if (this.config.remoteFileRefreshInterval !== 0) {
				if ((this.config.remoteFileRefreshInterval >= this.refreshMinimumDelay) || window.mmTestMode === "true") {
					setInterval(async () => {
						const response = await this.loadComplimentFile();
						if (response) {
							this.compliments_new = JSON.parse(response);
						}
						else {
							Log.error(`[compliments] ${this.name} remoteFile refresh failed`);
						}
					},
					this.config.remoteFileRefreshInterval);
				} else {
					Log.error(`[compliments] ${this.name} remoteFileRefreshInterval less than minimum`);
				}
			}
		}
		let minute_sync_delay = 1;
		for (const m of Object.keys(this.config.compliments)) {
			if (this.isCronEntry(m)) {
				minute_sync_delay = (60 - (moment().second())) * 1000;
				break;
			}
		}
		setTimeout(() => {
			setInterval(() => {
				this.updateDom(this.config.fadeSpeed);
			}, this.config.updateInterval);
		},
		minute_sync_delay);
	},

	isCronEntry (entry) {
		return entry.includes(" ");
	},

	getSecondsUntilNextCronRun (cronExpression, timestamp = new Date()) {
		const adjustedTimestamp = new Date(timestamp.getTime() - 1000);

		const cronJob = new Cron(cronExpression);
		const nextRunTime = cronJob.nextRun(adjustedTimestamp);

		const secondsDelta = (nextRunTime - adjustedTimestamp) / 1000;
		return secondsDelta;
	},

	randomIndex (compliments) {
		if (compliments.length <= 1) {
			return 0;
		}

		const generate = () => {
			return Math.floor(Math.random() * compliments.length);
		};

		let complimentIndex = generate();

		while (complimentIndex === this.lastComplimentIndex) {
			complimentIndex = generate();
		}

		this.lastComplimentIndex = complimentIndex;

		return complimentIndex;
	},

	complimentArray () {
		const now = moment();
		const hour = now.hour();
		const date = now.format("YYYY-MM-DD");
		let compliments = [];

		let timeOfDay;
		if (hour >= this.config.morningStartTime && hour < this.config.morningEndTime) {
			timeOfDay = "morning";
		} else if (hour >= this.config.afternoonStartTime && hour < this.config.afternoonEndTime) {
			timeOfDay = "afternoon";
		} else {
			timeOfDay = "evening";
		}

		if (this.config.compliments.hasOwnProperty(timeOfDay)) {
			compliments = [...this.config.compliments[timeOfDay]];
		}

		if (this.currentWeatherType in this.config.compliments) {
			Array.prototype.push.apply(compliments, this.config.compliments[this.currentWeatherType]);
			if (!this.pre_defined_types.includes(this.currentWeatherType)) {
				this.pre_defined_types.push(this.currentWeatherType);
			}
		}

		Array.prototype.push.apply(compliments, this.config.compliments.anytime);

		const temp_list = Object.keys(this.config.compliments).filter((k) => {
			if (this.pre_defined_types.includes(k)) return false;
			else return true;
		});

		const date_compliments = [];
		for (const entry of temp_list) {
			if (this.isCronEntry(entry)) {
				if (new RegExp(this.cron_regex).test(entry)) {
					if (this.getSecondsUntilNextCronRun(entry, now.set("seconds", 0).toDate()) <= 1) {
						Array.prototype.push.apply(date_compliments, this.config.compliments[entry]);
					}
				} else Log.error(`[compliments] cron syntax invalid=${JSON.stringify(entry)}`);
			} else if (new RegExp(entry).test(date)) {
				Array.prototype.push.apply(date_compliments, this.config.compliments[entry]);
			}
		}

		if (date_compliments.length) {
			if (this.config.specialDayUnique) {
				compliments.length = 0;
			}
			Array.prototype.push.apply(compliments, date_compliments);
		}

		return compliments;
	},

	async loadComplimentFile () {
		const { remoteFile, remoteFileRefreshInterval } = this.config;
		const isRemote = remoteFile.startsWith("http://") || remoteFile.startsWith("https://");
		let url = isRemote ? remoteFile : this.file(remoteFile);

		try {
			const urlObj = new URL(url);
			if (isRemote && remoteFileRefreshInterval !== 0) {
				urlObj.searchParams.set("dummy", Date.now());
			}
			url = urlObj.toString();
		} catch {
			Log.warn(`[compliments] Invalid URL: ${url}`);
		}

		try {
			const response = await fetch(url);
			if (!response.ok) {
				Log.error(`[compliments] HTTP error: ${response.status} ${response.statusText}`);
				return null;
			}
			return await response.text();
		} catch (error) {
			Log.info("[compliments] fetch failed:", error.message);
			return null;
		}
	},

	getRandomCompliment () {
		const compliments = this.complimentArray();
		let index;
		if (this.config.random) {
			index = this.randomIndex(compliments);
		} else {
			index = this.lastIndexUsed >= compliments.length - 1 ? 0 : ++this.lastIndexUsed;
		}

		return compliments[index] || "";
	},

	getDom () {
		const wrapper = document.createElement("div");
		wrapper.className = this.config.classes ? this.config.classes : "thin xlarge bright pre-line";
		const complimentText = this.getRandomCompliment();
		const parts = complimentText.split("\n");
		const compliment = document.createElement("span");
		for (const part of parts) {
			if (part !== "") {
				compliment.appendChild(document.createTextNode(part));
				compliment.appendChild(document.createElement("BR"));
			}
		}
		if (compliment.children.length > 0) {
			compliment.lastElementChild.remove();
			wrapper.appendChild(compliment);
		}
		if (this.compliments_new) {
			if (JSON.stringify(this.config.compliments) !== JSON.stringify(this.compliments_new)) {
				this.config.compliments = this.compliments_new;
				this.lastIndexUsed = -1;
			}
			this.compliments_new = null;
		}
		if (window.mmTestMode === "true") {
			if (this.config.remoteFile2 !== null && this.config.remoteFileRefreshInterval !== 0) {
				this.config.remoteFile = this.config.remoteFile2;
			}
		}
		return wrapper;
	},

	notificationReceived (notification, payload) {
		if (notification === "CURRENTWEATHER_TYPE") {
			this.currentWeatherType = payload.type;
		}
	}
});
