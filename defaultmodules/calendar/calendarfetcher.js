const ical = require("node-ical");
const Log = require("logger");
const CalendarFetcherUtils = require("./calendarfetcherutils");
const HTTPFetcher = require("#http_fetcher");

class CalendarFetcher {

	constructor (url, reloadInterval, excludedEvents, maximumEntries, maximumNumberOfDays, auth, includePastEvents, selfSignedCert) {
		this.url = url;
		this.excludedEvents = excludedEvents;
		this.maximumEntries = maximumEntries;
		this.maximumNumberOfDays = maximumNumberOfDays;
		this.includePastEvents = includePastEvents;

		this.events = [];
		this.lastFetch = null;
		this.fetchFailedCallback = () => {};
		this.eventsReceivedCallback = () => {};

		this.httpFetcher = new HTTPFetcher({
			url,
			reloadInterval,
			auth,
			selfSignedCert
		});

		this.httpFetcher.on("response", (response) => this.#handleResponse(response));
		this.httpFetcher.on("error", (errorInfo) => this.fetchFailedCallback(this, errorInfo));
	}

	async #handleResponse (response) {
		try {
			if (response.status === 304) {
				this.lastFetch = Date.now();
				this.broadcastEvents();
				return;
			}

			const responseData = await response.text();

			const filteredData = await CalendarFetcherUtils.preFilterICS(responseData, {
				includePastEvents: this.includePastEvents,
				maximumNumberOfDays: this.maximumNumberOfDays
			});

			const parsed = await ical.async.parseICS(filteredData);

			Log.debug(`Parsed iCal data from ${this.url} with ${Object.keys(parsed).length} entries.`);

			this.events = CalendarFetcherUtils.filterEvents(parsed, {
				excludedEvents: this.excludedEvents,
				includePastEvents: this.includePastEvents,
				maximumEntries: this.maximumEntries,
				maximumNumberOfDays: this.maximumNumberOfDays
			});

			this.lastFetch = Date.now();
			this.broadcastEvents();
		} catch (error) {
			Log.error(`${this.url} - iCal parsing failed: ${error.message}`);
			this.fetchFailedCallback(this, {
				message: `iCal parsing failed: ${error.message}`,
				status: null,
				errorType: "PARSE_ERROR",
				translationKey: "MODULE_ERROR_UNSPECIFIED",
				retryAfter: this.httpFetcher.reloadInterval,
				retryCount: 0,
				url: this.url,
				originalError: error
			});
		}
	}

	fetchCalendar () {
		this.httpFetcher.startPeriodicFetch();
	}

	shouldRefetch () {
		if (!this.lastFetch) {
			return true;
		}
		const timeSinceLastFetch = Date.now() - this.lastFetch;
		return timeSinceLastFetch >= this.httpFetcher.reloadInterval;
	}

	broadcastEvents () {
		Log.info(`Broadcasting ${this.events.length} events from ${this.url}.`);
		this.eventsReceivedCallback(this);
	}

	onReceive (callback) {
		this.eventsReceivedCallback = callback;
	}

	onError (callback) {
		this.fetchFailedCallback = callback;
	}
}

module.exports = CalendarFetcher;
