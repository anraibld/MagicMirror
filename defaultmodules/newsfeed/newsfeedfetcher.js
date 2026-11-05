const stream = require("node:stream");
const FeedParser = require("feedparser");
const iconv = require("iconv-lite");
const Log = require("logger");
const { normalizeFeedItem } = require("./feeditem");
const HTTPFetcher = require("#http_fetcher");

const SAFE_HTML_TAGS = ["b", "strong", "i", "em", "u", "br", "code", "s", "sub", "sup"];

class NewsfeedFetcher {

	constructor (url, reloadInterval, encoding, logFeedWarnings, useCorsProxy, allowedBasicHtmlTags = []) {
		this.url = url;
		this.encoding = encoding;
		this.logFeedWarnings = logFeedWarnings;
		this.useCorsProxy = useCorsProxy;

		const requestedTags = (Array.isArray(allowedBasicHtmlTags) ? allowedBasicHtmlTags : []).map((tag) => String(tag).trim().toLowerCase());
		this.allowedBasicHtmlTags = requestedTags.filter((tag) => SAFE_HTML_TAGS.includes(tag));
		const ignoredTags = requestedTags.filter((tag) => !SAFE_HTML_TAGS.includes(tag));
		if (ignoredTags.length > 0) {
			Log.warn(`Ignoring unsupported allowedBasicHtmlTags [${ignoredTags.join(", ")}] for url ${url}. Allowed tags are: ${SAFE_HTML_TAGS.join(", ")}`);
		}

		this.items = [];
		this.fetchFailedCallback = () => {};
		this.itemsReceivedCallback = () => {};

		this.httpFetcher = new HTTPFetcher({
			url,
			reloadInterval: Math.max(reloadInterval, 1000),
			headers: {
				"Cache-Control": "max-age=0, no-cache, no-store, must-revalidate",
				Pragma: "no-cache"
			}
		});

		this.httpFetcher.on("response", (response) => void this.#handleResponse(response));
		this.httpFetcher.on("error", (errorInfo) => this.fetchFailedCallback(this, errorInfo));
	}

	#createParseError (message, error) {
		return {
			message,
			status: null,
			errorType: "PARSE_ERROR",
			translationKey: "MODULE_ERROR_UNSPECIFIED",
			retryAfter: this.httpFetcher.reloadInterval,
			retryCount: 0,
			url: this.url,
			originalError: error
		};
	}

	async #handleResponse (response) {
		if (response.status === 304) {
			this.broadcastItems();
			return;
		}

		this.items = [];
		const parser = new FeedParser();

		parser.on("data", (item) => {
			const normalizedItem = normalizeFeedItem(item, {
				allowedBasicHtmlTags: this.allowedBasicHtmlTags,
				useCorsProxy: this.useCorsProxy,
				logFeedWarnings: this.logFeedWarnings
			});
			if (normalizedItem) {
				this.items.push(normalizedItem);
			}
		});

		parser.on("meta", () => {
			const ttlNode = parser.meta["rss:ttl"];
			const minutes = ttlNode && parseInt(ttlNode["#"], 10);
			if (minutes) {
				const ttlms = Math.min(minutes * 60 * 1000, 86400000);
				if (ttlms > this.httpFetcher.reloadInterval) {
					this.httpFetcher.reloadInterval = ttlms;
					Log.info(`reloadInterval set to ttl=${ttlms} for url ${this.url}`);
				}
			}
		});

		try {
			const nodeStream = response.body instanceof stream.Readable
				? response.body
				: stream.Readable.fromWeb(response.body);
			await stream.promises.pipeline(nodeStream, iconv.decodeStream(this.encoding), parser);
			this.broadcastItems();
		} catch (error) {
			Log.error(`${this.url} - Stream processing failed: ${error.message}`);
			this.fetchFailedCallback(this, this.#createParseError(`Stream processing failed: ${error.message}`, error));
		}
	}

	setReloadInterval (interval) {
		if (interval > 1000 && interval < this.httpFetcher.reloadInterval) {
			this.httpFetcher.reloadInterval = interval;
		}
	}

	startFetch () {
		this.httpFetcher.startPeriodicFetch();
	}

	broadcastItems () {
		if (this.items.length <= 0) {
			Log.info("No items to broadcast yet.");
			return;
		}
		Log.info(`Broadcasting ${this.items.length} items.`);
		this.itemsReceivedCallback(this);
	}

	onReceive (callback) {
		this.itemsReceivedCallback = callback;
	}

	onError (callback) {
		this.fetchFailedCallback = callback;
	}
}

module.exports = NewsfeedFetcher;
