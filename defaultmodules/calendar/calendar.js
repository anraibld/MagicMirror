
Module.register("calendar", {
	defaults: {
		maximumEntries: 10,
		maximumNumberOfDays: 365,
		limitDays: 0,
		pastDaysCount: 0,
		displaySymbol: true,
		defaultSymbol: "calendar-days",
		defaultSymbolClassName: "fas fa-fw fa-",
		showLocation: false,
		displayRepeatingCountTitle: false,
		defaultRepeatingCountTitle: "",
		maxTitleLength: 25,
		maxLocationTitleLength: 25,
		wrapEvents: false,
		wrapLocationEvents: false,
		maxTitleLines: 3,
		maxEventTitleLines: 3,
		fetchInterval: 60 * 60 * 1000,
		animationSpeed: 2000,
		fade: true,
		fadePoint: 0.25,
		urgency: 7,
		timeFormat: "relative",
		dateFormat: "MMM Do",
		dateEndFormat: "LT",
		fullDayEventDateFormat: "MMM Do",
		showEnd: false,
		showEndsOnlyWithDuration: false,
		getRelative: 6,
		hidePrivate: false,
		hideOngoing: false,
		hideTime: false,
		hideDuplicates: true,
		showTimeToday: false,
		colored: false,
		forceUseCurrentTime: false,
		tableClass: "small",
		calendars: [
			{
				symbol: "calendar-alt",
				url: "https://www.calendarlabs.com/templates/ical/US-Holidays.ics"
			}
		],
		customEvents: [
			{ keyword: ".*", transform: { search: "De verjaardag van ", replace: "" } },
			{ keyword: ".*", transform: { search: "'s birthday", replace: "" } }
		],
		locationTitleReplace: {
			"street ": ""
		},
		broadcastEvents: true,
		excludedEvents: [],
		sliceMultiDayEvents: false,
		broadcastPastEvents: false,
		nextDaysRelative: false,
		selfSignedCert: false,
		coloredText: false,
		coloredBorder: false,
		coloredSymbol: false,
		coloredBackground: false,
		limitDaysNeverSkip: false,
		flipDateHeaderTitle: false,
		updateOnFetch: true
	},

	getStyles () {
		return ["calendar.css", "font-awesome.css"];
	},

	getScripts () {
		return ["calendarutils.js", "moment.js", "moment-timezone.js"];
	},

	getTranslations () {

		return false;
	},

	start () {
		Log.info(`Starting module: ${this.name}`);

		if (this.config.colored) {
			Log.warn("[calendar] Your are using the deprecated config values 'colored'. Please switch to 'coloredSymbol' & 'coloredText'!");
			this.config.coloredText = true;
			this.config.coloredSymbol = true;
		}
		if (this.config.coloredSymbolOnly) {
			Log.warn("[calendar] Your are using the deprecated config values 'coloredSymbolOnly'. Please switch to 'coloredSymbol' & 'coloredText'!");
			this.config.coloredText = false;
			this.config.coloredSymbol = true;
		}

		moment.updateLocale(globalThis.config.language, CalendarUtils.getLocaleSpecification(globalThis.config.timeFormat));

		this.calendarData = {};

		this.loaded = false;

		this.calendarDisplayer = {};

		this.config.calendars.forEach((calendar) => {
			calendar.url = calendar.url.replace("webcal://", "http://");

			const calendarConfig = {
				maximumEntries: calendar.maximumEntries,
				maximumNumberOfDays: calendar.maximumNumberOfDays,
				pastDaysCount: calendar.pastDaysCount,
				broadcastPastEvents: calendar.broadcastPastEvents,
				selfSignedCert: calendar.selfSignedCert,
				excludedEvents: calendar.excludedEvents,
				fetchInterval: calendar.fetchInterval
			};

			if (typeof calendar.symbolClass === "undefined" || calendar.symbolClass === null) {
				calendarConfig.symbolClass = "";
			}
			if (typeof calendar.titleClass === "undefined" || calendar.titleClass === null) {
				calendarConfig.titleClass = "";
			}
			if (typeof calendar.timeClass === "undefined" || calendar.timeClass === null) {
				calendarConfig.timeClass = "";
			}

			if (calendar.user && calendar.pass) {
				Log.warn("[calendar] Deprecation warning: Please update your calendar authentication configuration.");
				Log.warn("https://docs.magicmirror.builders/modules/calendar.html#configuration-options");
				calendar.auth = {
					user: calendar.user,
					pass: calendar.pass
				};
			}

			this.addCalendar(calendar.url, calendar.auth, calendarConfig);
		});

		if (typeof this.config.titleReplace !== "undefined") {
			Log.warn("[calendar] Deprecation warning: Please consider upgrading your calendar titleReplace configuration to customEvents.");
			for (const [titlesearchstr, titlereplacestr] of Object.entries(this.config.titleReplace)) {
				this.config.customEvents.push({ keyword: ".*", transform: { search: titlesearchstr, replace: titlereplacestr } });
			}
		}

		this.selfUpdate();
	},

	notificationReceived (notification, payload) {
		if (notification === "FETCH_CALENDAR") {
			this.sendSocketNotification(notification, { url: payload.url, id: this.identifier });
		}
	},

	socketNotificationReceived (notification, payload) {

		if (this.identifier !== payload.id) {
			return;
		}

		if (notification === "CALENDAR_EVENTS") {
			if (!this.calendarData[payload.url]) {
				this.calendarData[payload.url] = { events: null, checksum: null };
			}
			this.calendarData[payload.url].events = payload.events;

			this.error = null;
			this.loaded = true;

			if (this.config.broadcastEvents) {
				this.broadcastEvents();
			}
			if (this.calendarData[payload.url].checksum === payload.checksum) {
				return;
			}
			this.calendarData[payload.url].checksum = payload.checksum;

			if (!this.config.updateOnFetch) {
				if (this.calendarDisplayer[payload.url] === undefined) {
					this.updateDom(this.config.animationSpeed);
					this.calendarDisplayer[payload.url] = true;
				} else {
					Log.debug("[calendar] DOM not updated waiting self update()");
				}
				return;
			}
		} else if (notification === "CALENDAR_ERROR") {
			const error_message = this.translate(payload.error_type);
			this.error = this.translate("MODULE_CONFIG_ERROR", { MODULE_NAME: this.name, ERROR: error_message });
			this.loaded = true;
		}

		this.updateDom(this.config.animationSpeed);
	},

	getDom () {
		const events = this.createEventList(true);
		const wrapper = document.createElement("table");
		wrapper.className = this.config.tableClass;

		if (this.error) {
			wrapper.innerHTML = this.error;
			wrapper.className = `${this.config.tableClass} dimmed`;
			return wrapper;
		}

		if (events.length === 0) {
			wrapper.innerHTML = this.loaded ? this.translate("EMPTY") : this.translate("LOADING");
			wrapper.className = `${this.config.tableClass} dimmed`;
			return wrapper;
		}

		let currentFadeStep = 0;
		let startFade;
		let fadeSteps;

		if (this.config.fade && this.config.fadePoint < 1) {
			if (this.config.fadePoint < 0) {
				this.config.fadePoint = 0;
			}
			startFade = events.length * this.config.fadePoint;
			fadeSteps = events.length - startFade;
		}

		let lastSeenDate = "";

		events.forEach((event, index) => {
			const eventStartDateMoment = this.timestampToMoment(event.startDate);
			const eventEndDateMoment = this.timestampToMoment(event.endDate);
			const dateAsString = eventStartDateMoment.format(this.config.dateFormat);
			if (this.config.timeFormat === "dateheaders") {
				if (lastSeenDate !== dateAsString) {
					const dateRow = document.createElement("tr");
					dateRow.className = "dateheader normal";
					if (event.today) dateRow.className += " today";
					else if (event.dayBeforeYesterday) dateRow.className += " dayBeforeYesterday";
					else if (event.yesterday) dateRow.className += " yesterday";
					else if (event.tomorrow) dateRow.className += " tomorrow";
					else if (event.dayAfterTomorrow) dateRow.className += " dayAfterTomorrow";

					const dateCell = document.createElement("td");
					dateCell.colSpan = "3";
					dateCell.innerHTML = dateAsString;
					dateCell.style.paddingTop = "10px";
					dateRow.appendChild(dateCell);
					wrapper.appendChild(dateRow);

					if (this.config.fade && index >= startFade) {
						currentFadeStep = index - startFade;
						dateRow.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
					}

					lastSeenDate = dateAsString;
				}
			}

			const eventWrapper = document.createElement("tr");

			if (this.config.coloredText) {
				eventWrapper.style.cssText = `color:${this.colorForUrl(event.url, false)}`;
			}

			if (this.config.coloredBackground) {
				eventWrapper.style.backgroundColor = this.colorForUrl(event.url, true);
			}

			if (this.config.coloredBorder) {
				eventWrapper.style.borderColor = this.colorForUrl(event.url, false);
			}

			eventWrapper.className = "event-wrapper normal event";
			if (event.today) eventWrapper.className += " today";
			else if (event.dayBeforeYesterday) eventWrapper.className += " dayBeforeYesterday";
			else if (event.yesterday) eventWrapper.className += " yesterday";
			else if (event.tomorrow) eventWrapper.className += " tomorrow";
			else if (event.dayAfterTomorrow) eventWrapper.className += " dayAfterTomorrow";

			const symbolWrapper = document.createElement("td");

			if (this.config.displaySymbol) {
				if (this.config.coloredSymbol) {
					symbolWrapper.style.cssText = `color:${this.colorForUrl(event.url, false)}`;
				}

				const symbolClass = this.symbolClassForUrl(event.url);
				symbolWrapper.className = `symbol ${symbolClass}`;

				const symbols = this.symbolsForEvent(event);
				symbols.forEach((s) => {
					const symbol = document.createElement("span");
					symbol.className = s;
					symbolWrapper.appendChild(symbol);
				});
				eventWrapper.appendChild(symbolWrapper);
			} else if (this.config.timeFormat === "dateheaders") {
				const blankCell = document.createElement("td");
				blankCell.innerHTML = "&nbsp;&nbsp;&nbsp;";
				eventWrapper.appendChild(blankCell);
			}

			const titleWrapper = document.createElement("td");
			let repeatingCountTitle = "";

			if (this.config.displayRepeatingCountTitle && event.firstYear !== undefined) {
				repeatingCountTitle = this.countTitleForUrl(event.url);

				if (repeatingCountTitle !== "") {
					const thisYear = eventStartDateMoment.year(),
						yearDiff = thisYear - event.firstYear;

					if (yearDiff > 0) {
						repeatingCountTitle = `, ${yearDiff} ${repeatingCountTitle}`;
					}
				}
			}

			var transformedTitle = event.title;

			if (this.config.customEvents.length > 0) {
				for (const ev in this.config.customEvents) {
					const needle = new RegExp(this.config.customEvents[ev].keyword, "gi");
					if (needle.test(event.title)) {
						if (typeof this.config.customEvents[ev].transform === "object") {
							transformedTitle = CalendarUtils.titleTransform(transformedTitle, [this.config.customEvents[ev].transform]);
						}
						if (typeof this.config.customEvents[ev].color !== "undefined" && this.config.customEvents[ev].color !== "") {
							if (this.config.coloredText) {
								eventWrapper.style.cssText = `color:${this.config.customEvents[ev].color}`;
								titleWrapper.style.cssText = `color:${this.config.customEvents[ev].color}`;
							}
							if (this.config.displaySymbol && this.config.coloredSymbol) {
								symbolWrapper.style.cssText = `color:${this.config.customEvents[ev].color}`;
							}
						}
						if (typeof this.config.customEvents[ev].eventClass !== "undefined" && this.config.customEvents[ev].eventClass !== "") {
							eventWrapper.className += ` ${this.config.customEvents[ev].eventClass}`;
						}
					}
				}
			}

			titleWrapper.innerHTML = CalendarUtils.shorten(transformedTitle, this.config.maxTitleLength, this.config.wrapEvents, this.config.maxTitleLines) + repeatingCountTitle;

			const titleClass = this.titleClassForUrl(event.url);

			if (!this.config.coloredText) {
				titleWrapper.className = `title bright ${titleClass}`;
			} else {
				titleWrapper.className = `title ${titleClass}`;
			}

			if (this.config.timeFormat === "dateheaders") {
				this.renderDateHeadersEventTime(eventWrapper, titleWrapper, event, eventStartDateMoment, eventEndDateMoment);
			} else {
				const timeWrapper = document.createElement("td");

				eventWrapper.appendChild(titleWrapper);
				const now = moment();

				if (this.config.timeFormat === "absolute") {
					timeWrapper.innerHTML = this.buildAbsoluteTimeText(event, eventStartDateMoment, eventEndDateMoment, now);
				} else {
					timeWrapper.innerHTML = this.buildRelativeTimeText(event, eventStartDateMoment, eventEndDateMoment, now);
				}

				timeWrapper.className = `time light ${this.timeClassForUrl(event.url)}`;
				eventWrapper.appendChild(timeWrapper);
			}

			if (index >= startFade) {
				currentFadeStep = index - startFade;
				eventWrapper.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
			}
			wrapper.appendChild(eventWrapper);

			if (this.config.showLocation) {
				if (event.location !== false) {
					const locationRow = document.createElement("tr");
					locationRow.className = "event-wrapper-location normal xsmall light";
					if (event.today) locationRow.className += " today";
					else if (event.dayBeforeYesterday) locationRow.className += " dayBeforeYesterday";
					else if (event.yesterday) locationRow.className += " yesterday";
					else if (event.tomorrow) locationRow.className += " tomorrow";
					else if (event.dayAfterTomorrow) locationRow.className += " dayAfterTomorrow";

					if (this.config.displaySymbol) {
						const symbolCell = document.createElement("td");
						locationRow.appendChild(symbolCell);
					}

					if (this.config.coloredText) {
						locationRow.style.cssText = `color:${this.colorForUrl(event.url, false)}`;
					}

					if (this.config.coloredBackground) {
						locationRow.style.backgroundColor = this.colorForUrl(event.url, true);
					}

					if (this.config.coloredBorder) {
						locationRow.style.borderColor = this.colorForUrl(event.url, false);
					}

					const descCell = document.createElement("td");
					descCell.className = "location";
					descCell.colSpan = "2";

					const transformedTitle = CalendarUtils.titleTransform(event.location, this.config.locationTitleReplace);
					descCell.innerHTML = CalendarUtils.shorten(transformedTitle, this.config.maxLocationTitleLength, this.config.wrapLocationEvents, this.config.maxEventTitleLines);
					locationRow.appendChild(descCell);

					wrapper.appendChild(locationRow);

					if (index >= startFade) {
						currentFadeStep = index - startFade;
						locationRow.style.opacity = 1 - (1 / fadeSteps) * currentFadeStep;
					}
				}
			}
		});

		return wrapper;
	},

	timestampToMoment (timestamp) {
		return moment(timestamp, "x").tz(moment.tz.guess());
	},

	setRelativeDayFlags (event, dayMoment, now) {
		event.today = dayMoment.isSame(now, "d");
		event.dayBeforeYesterday = dayMoment.isSame(now.clone().subtract(2, "days"), "d");
		event.yesterday = dayMoment.isSame(now.clone().subtract(1, "days"), "d");
		event.tomorrow = dayMoment.isSame(now.clone().add(1, "days"), "d");
		event.dayAfterTomorrow = dayMoment.isSame(now.clone().add(2, "days"), "d");
	},

	createEventList (limitNumberOfEntries) {
		const now = moment();
		const future = now.clone().startOf("day").add(this.config.maximumNumberOfDays, "days");

		let events = [];

		for (const calendarUrl in this.calendarData) {
			const calendar = this.calendarData[calendarUrl].events;
			const remainingEntries = this.maximumEntriesForUrl(calendarUrl);
			const maxPastDaysCompare = now.clone().subtract(this.maximumPastDaysForUrl(calendarUrl), "days");
			const by_url_calevents = [];
			for (const e in calendar) {
				const event = JSON.parse(JSON.stringify(calendar[e]));
				const eventStartDateMoment = this.timestampToMoment(event.startDate);
				const eventEndDateMoment = this.timestampToMoment(event.endDate);

				if (this.config.hidePrivate && event.class === "PRIVATE") {
					continue;
				}
				if (limitNumberOfEntries) {
					if (eventEndDateMoment.isBefore(maxPastDaysCompare)) {
						continue;
					}
					if (this.config.hideOngoing && eventStartDateMoment.isBefore(now)) {
						continue;
					}
					if (this.config.hideDuplicates && this.listContainsEvent(events, event)) {
						continue;
					}
				}

				event.url = calendarUrl;
				this.setRelativeDayFlags(event, eventStartDateMoment, now);

				const eventStartDay = eventStartDateMoment.clone().startOf("day");
				const eventEndDay = eventEndDateMoment.clone().startOf("day");
				const endsAtMidnight = !eventEndDateMoment.isAfter(eventEndDay);
				const dayCount = eventEndDay.diff(eventStartDay, "days") + (endsAtMidnight ? 0 : 1);
				if (this.config.sliceMultiDayEvents && dayCount > 1) {
					const splitEvents = [];
					let sliceStart = eventStartDateMoment.clone();

					for (let dayNumber = 1; dayNumber <= dayCount; dayNumber++) {
						const isLastSlice = dayNumber === dayCount;
						const nextMidnight = sliceStart.clone().startOf("day").add(1, "day");

						const slice = JSON.parse(JSON.stringify(event));
						slice.startDate = sliceStart.format("x");
						slice.endDate = isLastSlice ? event.endDate : nextMidnight.clone().subtract(1, "millisecond").format("x");
						slice.title = `${event.title} (${dayNumber}/${dayCount})`;
						this.setRelativeDayFlags(slice, sliceStart, now);
						splitEvents.push(slice);

						sliceStart = nextMidnight;
					}

					for (const splitEvent of splitEvents) {
						if (this.timestampToMoment(splitEvent.endDate).isAfter(now) && this.timestampToMoment(splitEvent.endDate).isSameOrBefore(future)) {
							by_url_calevents.push(splitEvent);
						}
					}
				} else {
					by_url_calevents.push(event);
				}
			}
			if (limitNumberOfEntries) {
				by_url_calevents.sort((a, b) => {
					return a.startDate - b.startDate;
				});
				Log.debug(`[calendar] pushing ${by_url_calevents.length} events to total with room for ${remainingEntries}`);
				events = events.concat(by_url_calevents.slice(0, remainingEntries));
				Log.debug(`[calendar] events for calendar=${events.length}`);
			} else {
				events = events.concat(by_url_calevents);
			}
		}
		Log.info(`[calendar] sorting events count=${events.length}`);
		events.sort((a, b) => {
			return a.startDate - b.startDate;
		});

		if (!limitNumberOfEntries) {
			return events;
		}

		if (this.config.limitDays > 0 && events.length > 0) {
			const eventsByDate = Object.groupBy(events, (ev) => this.timestampToMoment(ev.startDate).format("YYYY-MM-DD"));
			const newEvents = [];
			const currentDate = moment();
			let daysCollected = 0;

			while (daysCollected < this.config.limitDays) {
				const dateStr = currentDate.format("YYYY-MM-DD");
				if (eventsByDate[dateStr] && eventsByDate[dateStr].length > 0) {
					newEvents.push(...eventsByDate[dateStr].filter((ev) => this.timestampToMoment(ev.endDate).isAfter(moment())));
				}
				daysCollected++;
				currentDate.add(1, "day");
			}
			events = newEvents;
		}
		Log.info(`[calendar] slicing events total maxCount=${this.config.maximumEntries}`);
		return events.slice(0, this.config.maximumEntries);
	},

	listContainsEvent (eventList, event) {
		for (const evt of eventList) {
			if (evt.title === event.title && parseInt(evt.startDate) === parseInt(event.startDate) && parseInt(evt.endDate) === parseInt(event.endDate)) {
				return true;
			}
		}
		return false;
	},

	addCalendar (url, auth, calendarConfig) {
		this.sendSocketNotification("ADD_CALENDAR", {
			id: this.identifier,
			url: url,
			excludedEvents: calendarConfig.excludedEvents || this.config.excludedEvents,
			maximumEntries: calendarConfig.maximumEntries || this.config.maximumEntries,
			maximumNumberOfDays: calendarConfig.maximumNumberOfDays || this.config.maximumNumberOfDays,
			pastDaysCount: calendarConfig.pastDaysCount || this.config.pastDaysCount,
			fetchInterval: calendarConfig.fetchInterval || this.config.fetchInterval,
			symbolClass: calendarConfig.symbolClass,
			titleClass: calendarConfig.titleClass,
			timeClass: calendarConfig.timeClass,
			auth: auth,
			broadcastPastEvents: calendarConfig.broadcastPastEvents || this.config.broadcastPastEvents,
			selfSignedCert: calendarConfig.selfSignedCert || this.config.selfSignedCert
		});
	},

	symbolsForEvent (event) {
		let symbols = this.getCalendarPropertyAsArray(event.url, "symbol", this.config.defaultSymbol);

		if (event.recurringEvent === true && this.hasCalendarProperty(event.url, "recurringSymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "recurringSymbol", this.config.defaultSymbol), symbols);
		}

		if (event.fullDayEvent === true && this.hasCalendarProperty(event.url, "fullDaySymbol")) {
			symbols = this.mergeUnique(this.getCalendarPropertyAsArray(event.url, "fullDaySymbol", this.config.defaultSymbol), symbols);
		}

		for (const ev of this.config.customEvents) {
			if (typeof ev.symbol !== "undefined" && ev.symbol !== "") {
				const needle = new RegExp(ev.keyword, "gi");
				if (needle.test(event.title)) {
					const className = ev.symbolClassName || this.getCalendarProperty(event.url, "symbolClassName", this.config.defaultSymbolClassName);
					symbols[0] = className + ev.symbol;
					break;
				}
			}
		}

		return symbols;
	},

	mergeUnique (arr1, arr2) {
		return arr1.concat(
			arr2.filter((item) => {
				return arr1.indexOf(item) === -1;
			})
		);
	},

	createDateHeadersTimeWrapper (url) {
		const timeWrapper = document.createElement("td");
		timeWrapper.className = `time light ${this.config.flipDateHeaderTitle ? "align-right " : "align-left "}${this.timeClassForUrl(url)}`;
		timeWrapper.style.paddingLeft = "2px";
		timeWrapper.style.textAlign = this.config.flipDateHeaderTitle ? "right" : "left";
		return timeWrapper;
	},

	hasEventDuration (event) {
		return event.startDate !== event.endDate;
	},

	shouldShowDateHeadersTimedEnd (event) {
		return this.config.showEnd && (!this.config.showEndsOnlyWithDuration || this.hasEventDuration(event));
	},

	shouldShowRelativeTimedEnd (event) {
		return !this.config.hideTime && this.config.showEnd && (!this.config.showEndsOnlyWithDuration || this.hasEventDuration(event));
	},

	getAdjustedFullDayEndMoment (endMoment) {
		return endMoment.clone().subtract(1, "second");
	},

	renderDateHeadersEventTime (eventWrapper, titleWrapper, event, eventStartDateMoment, eventEndDateMoment) {
		if (this.config.flipDateHeaderTitle) eventWrapper.appendChild(titleWrapper);

		if (event.fullDayEvent) {
			const adjustedEndMoment = this.getAdjustedFullDayEndMoment(eventEndDateMoment);
			if (this.config.showEnd && !this.config.showEndsOnlyWithDuration && !eventStartDateMoment.isSame(adjustedEndMoment, "d")) {
				const timeWrapper = this.createDateHeadersTimeWrapper(event.url);
				timeWrapper.innerHTML = `-${CalendarUtils.capFirst(adjustedEndMoment.format(this.config.fullDayEventDateFormat))}`;
				eventWrapper.appendChild(timeWrapper);
				if (!this.config.flipDateHeaderTitle) titleWrapper.classList.add("align-right");
			} else {
				titleWrapper.colSpan = "2";
				titleWrapper.classList.add("align-left");
			}
		} else {
			const timeWrapper = this.createDateHeadersTimeWrapper(event.url);
			timeWrapper.innerHTML = eventStartDateMoment.format("LT");

			if (this.shouldShowDateHeadersTimedEnd(event)) {
				timeWrapper.innerHTML += `-${CalendarUtils.capFirst(eventEndDateMoment.format("LT"))}`;
			}

			eventWrapper.appendChild(timeWrapper);
			if (!this.config.flipDateHeaderTitle) titleWrapper.classList.add("align-right");
		}

		if (!this.config.flipDateHeaderTitle) eventWrapper.appendChild(titleWrapper);
	},

	buildAbsoluteTimeText (event, eventStartDateMoment, eventEndDateMoment, now) {
		let timeText = CalendarUtils.capFirst(eventStartDateMoment.format(this.config.dateFormat));

		if (this.config.showEnd && (!this.config.showEndsOnlyWithDuration || this.hasEventDuration(event))) {
			const sameDay = this.isSameDay(eventStartDateMoment, eventEndDateMoment);
			if (sameDay && !this.dateFormatIncludesTime()) {
				timeText += `, ${eventStartDateMoment.format("LT")}`;
			}
			timeText += `-${this.formatTimedEventEnd(eventStartDateMoment, eventEndDateMoment)}`;
		}

		if (event.fullDayEvent) {
			const adjustedEndMoment = this.getAdjustedFullDayEndMoment(eventEndDateMoment);
			timeText = CalendarUtils.capFirst(eventStartDateMoment.format(this.config.fullDayEventDateFormat));

			if (this.config.showEnd && !this.config.showEndsOnlyWithDuration && !eventStartDateMoment.isSame(adjustedEndMoment, "d")) {
				timeText += `-${CalendarUtils.capFirst(adjustedEndMoment.format(this.config.fullDayEventDateFormat))}`;
			} else if (!eventStartDateMoment.isSame(adjustedEndMoment, "d") && eventStartDateMoment.isBefore(now)) {
				timeText = CalendarUtils.capFirst(now.format(this.config.fullDayEventDateFormat));
			}

			if (this.config.nextDaysRelative) {
				let relativeLabel = false;
				if (event.today) {
					timeText = CalendarUtils.capFirst(this.translate("TODAY"));
					relativeLabel = true;
				} else if (event.yesterday) {
					timeText = CalendarUtils.capFirst(this.translate("YESTERDAY"));
					relativeLabel = true;
				} else if (event.tomorrow) {
					timeText = CalendarUtils.capFirst(this.translate("TOMORROW"));
					relativeLabel = true;
				} else if (event.dayAfterTomorrow && this.translate("DAYAFTERTOMORROW") !== "DAYAFTERTOMORROW") {
					timeText = CalendarUtils.capFirst(this.translate("DAYAFTERTOMORROW"));
					relativeLabel = true;
				}

				if (relativeLabel && this.config.showEnd && !this.config.showEndsOnlyWithDuration && !eventStartDateMoment.isSame(adjustedEndMoment, "d")) {
					timeText += `-${CalendarUtils.capFirst(adjustedEndMoment.format(this.config.fullDayEventDateFormat))}`;
				}
			}

			return timeText;
		}

		if (this.config.getRelative > 0 && eventStartDateMoment.isBefore(now)) {
			return CalendarUtils.capFirst(
				this.translate("RUNNING", {
					fallback: `${this.translate("RUNNING")} {timeUntilEnd}`,
					timeUntilEnd: eventEndDateMoment.fromNow(true)
				})
			);
		}

		if (this.config.urgency > 0 && eventStartDateMoment.diff(now, "d") < this.config.urgency) {
			return CalendarUtils.capFirst(eventStartDateMoment.fromNow());
		}

		return timeText;
	},

	buildRelativeTimeText (event, eventStartDateMoment, eventEndDateMoment, now) {
		if (eventStartDateMoment.isSameOrAfter(now) || (event.fullDayEvent && eventEndDateMoment.diff(now, "days") === 0)) {
			let timeText;

			if (!this.config.hideTime && !event.fullDayEvent) {
				Log.debug("[calendar] event not hidden and not fullday");
				timeText = `${CalendarUtils.capFirst(eventStartDateMoment.calendar(null, { sameElse: this.config.dateFormat }))}`;
			} else {
				Log.debug("[calendar] event full day or hidden");
				timeText = `${CalendarUtils.capFirst(
					eventStartDateMoment.calendar(null, {
						sameDay: this.config.showTimeToday ? "LT" : `[${this.translate("TODAY")}]`,
						nextDay: `[${this.translate("TOMORROW")}]`,
						nextWeek: "dddd",
						sameElse: event.fullDayEvent ? this.config.fullDayEventDateFormat : this.config.dateFormat
					})
				)}`;
			}

			if (event.fullDayEvent) {
				if (event.today || (event.fullDayEvent && eventEndDateMoment.diff(now, "days") === 0)) {
					timeText = CalendarUtils.capFirst(this.translate("TODAY"));
				} else if (event.dayBeforeYesterday) {
					if (this.translate("DAYBEFOREYESTERDAY") !== "DAYBEFOREYESTERDAY") {
						timeText = CalendarUtils.capFirst(this.translate("DAYBEFOREYESTERDAY"));
					}
				} else if (event.yesterday) {
					timeText = CalendarUtils.capFirst(this.translate("YESTERDAY"));
				} else if (event.tomorrow) {
					timeText = CalendarUtils.capFirst(this.translate("TOMORROW"));
				} else if (event.dayAfterTomorrow) {
					if (this.translate("DAYAFTERTOMORROW") !== "DAYAFTERTOMORROW") {
						timeText = CalendarUtils.capFirst(this.translate("DAYAFTERTOMORROW"));
					}
				}

				if (this.config.showEnd && !this.config.showEndsOnlyWithDuration) {
					const adjustedEndMoment = this.getAdjustedFullDayEndMoment(eventEndDateMoment);
					if (!eventStartDateMoment.isSame(adjustedEndMoment, "d")) {
						timeText += `-${CalendarUtils.capFirst(adjustedEndMoment.format(this.config.fullDayEventDateFormat))}`;
					}
				}

				Log.info("[calendar] event fullday");
			} else if (eventStartDateMoment.diff(now, "h") < this.config.getRelative) {
				Log.info("[calendar] not full day but within getRelative size");
				timeText = `${CalendarUtils.capFirst(eventStartDateMoment.fromNow())}`;
			} else if (this.shouldShowRelativeTimedEnd(event)) {
				if (this.isSameDay(eventStartDateMoment, eventEndDateMoment)) {
					const sameElseFormat = this.dateFormatIncludesTime() ? this.config.dateFormat : `${this.config.dateFormat}, LT`;
					timeText = CalendarUtils.capFirst(
						eventStartDateMoment.calendar(null, { sameElse: sameElseFormat })
					);
				}
				timeText += `-${this.formatTimedEventEnd(eventStartDateMoment, eventEndDateMoment)}`;
			}

			return timeText;
		}

		return CalendarUtils.capFirst(
			this.translate("RUNNING", {
				fallback: `${this.translate("RUNNING")} {timeUntilEnd}`,
				timeUntilEnd: eventEndDateMoment.fromNow(true)
			})
		);
	},

	isSameDay (startMoment, endMoment) {
		return startMoment.isSame(endMoment, "d");
	},

	dateFormatIncludesTime () {
		const dateFormatWithoutLiterals = this.config.dateFormat.replace(/\[[^\]]*\]/g, "");
		const localeDateFormat = moment.localeData();
		const expandedDateFormat = dateFormatWithoutLiterals.replace(
			/LTS|LT|LLLL|LLL|LL|L|llll|lll|ll|l/g,
			(token) => localeDateFormat.longDateFormat(token) || token
		);
		const expandedDateFormatWithoutLiterals = expandedDateFormat.replace(/\[[^\]]*\]/g, "");
		return (/(H{1,2}|h{1,2}|k{1,2}|m{1,2}|s{1,2}|a|A)/).test(expandedDateFormatWithoutLiterals);
	},

	formatTimedEventEnd (startMoment, endMoment) {
		const endFormat = this.isSameDay(startMoment, endMoment) ? "LT" : this.config.dateEndFormat;
		return CalendarUtils.capFirst(endMoment.format(endFormat));
	},

	symbolClassForUrl (url) {
		return this.getCalendarProperty(url, "symbolClass", "");
	},

	titleClassForUrl (url) {
		return this.getCalendarProperty(url, "titleClass", "");
	},

	timeClassForUrl (url) {
		return this.getCalendarProperty(url, "timeClass", "");
	},

	calendarNameForUrl (url) {
		return this.getCalendarProperty(url, "name", "");
	},

	colorForUrl (url, isBg) {
		return this.getCalendarProperty(url, isBg ? "bgColor" : "color", "#fff");
	},

	countTitleForUrl (url) {
		return this.getCalendarProperty(url, "repeatingCountTitle", this.config.defaultRepeatingCountTitle);
	},

	maximumEntriesForUrl (url) {
		return this.getCalendarProperty(url, "maximumEntries", this.config.maximumEntries);
	},

	maximumPastDaysForUrl (url) {
		return this.getCalendarProperty(url, "pastDaysCount", this.config.pastDaysCount);
	},

	getCalendarProperty (url, property, defaultValue) {
		for (const calendar of this.config.calendars) {
			if (calendar.url === url && calendar.hasOwnProperty(property)) {
				return calendar[property];
			}
		}

		return defaultValue;
	},

	getCalendarPropertyAsArray (url, property, defaultValue) {
		let p = this.getCalendarProperty(url, property, defaultValue);
		if (property === "symbol" || property === "recurringSymbol" || property === "fullDaySymbol") {
			const className = this.getCalendarProperty(url, "symbolClassName", this.config.defaultSymbolClassName);
			if (p instanceof Array) {
				const t = [];
				p.forEach((n) => { t.push(className + n); });
				p = t;
			}
			else p = className + p;
		}
		if (!(p instanceof Array)) p = [p];
		return p;
	},

	hasCalendarProperty (url, property) {
		return !!this.getCalendarProperty(url, property, undefined);
	},

	broadcastEvents () {
		const eventList = this.createEventList(false);
		for (const event of eventList) {
			event.symbol = this.symbolsForEvent(event);
			event.calendarName = this.calendarNameForUrl(event.url);
			event.color = this.colorForUrl(event.url, false);
			delete event.url;
		}

		this.sendNotification("CALENDAR_EVENTS", eventList);
	},

	selfUpdate () {
		const ONE_MINUTE = 60 * 1000;
		setTimeout(
			() => {
				setInterval(() => {
					Log.debug("[calendar] self update");
					if (this.config.updateOnFetch) {
						this.updateDom(1);
					} else {
						this.updateDom(this.config.animationSpeed);
					}
				}, ONE_MINUTE);
			},
			ONE_MINUTE - (new Date() % ONE_MINUTE)
		);
	}
});
