const crypto = require("node:crypto");
const { htmlToText } = require("html-to-text");
const Log = require("logger");

const keepTagFormatter = (elem, walk, builder, formatOptions) => {
	const { tagName } = formatOptions;
	if (tagName === "br") {
		builder.addLiteral("<br>");
		return;
	}
	builder.addLiteral(`<${tagName}>`);
	walk(elem.children, builder);
	builder.addLiteral(`</${tagName}>`);
};

const sanitizeBasicHtml = (html, allowedTags = []) => {
	const keepTagSelectors = allowedTags.map((tagName) => ({ selector: tagName, format: "keepTag", options: { tagName } }));

	const text = htmlToText(html, {
		wordwrap: false,
		formatters: { keepTag: keepTagFormatter },
		selectors: [
			{ selector: "a", options: { ignoreHref: true, noAnchorUrl: true } },
			{ selector: "br", format: "inlineSurround", options: { prefix: " " } },
			{ selector: "img", format: "skip" },
			...keepTagSelectors
		]
	});

	const escaped = text
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;");

	if (allowedTags.length === 0) {
		return escaped;
	}

	const restoreAllowedTags = new RegExp(`&lt;(/?(?:${allowedTags.join("|")}))&gt;`, "g");
	return escaped.replace(restoreAllowedTags, "<$1>");
};

const normalizeFeedItem = (item, { allowedBasicHtmlTags = [], useCorsProxy = false, logFeedWarnings = false } = {}) => {
	const title = (item["rss:title"] && item["rss:title"]["#"]) || (item["atom:title"] && item["atom:title"]["#"]) || item.title;
	let description = item.description || item.summary || "";
	const pubdateValue = item.pubdate || item.date;
	const pubdate = pubdateValue instanceof Date ? pubdateValue.toISOString() : pubdateValue;
	const url = item.link || item.guid || "";

	if (!title || !pubdate) {
		if (logFeedWarnings) {
			Log.warn("Can't parse feed item:", item);
			Log.warn(`Title: ${title}`);
			Log.warn(`Description: ${description}`);
			Log.warn(`Pubdate: ${pubdate}`);
		}
		return null;
	}

	let displayTitle;
	if (allowedBasicHtmlTags.length > 0) {
		description = sanitizeBasicHtml(description, allowedBasicHtmlTags);
		displayTitle = sanitizeBasicHtml(title, allowedBasicHtmlTags);
	} else {
		const textOptions = {
			wordwrap: false,
			selectors: [
				{ selector: "a", options: { ignoreHref: true, noAnchorUrl: true } },
				{ selector: "br", format: "inlineSurround", options: { prefix: " " } },
				{ selector: "img", format: "skip" }
			]
		};
		description = htmlToText(description, textOptions);
		displayTitle = htmlToText(title, textOptions);
	}

	return {
		title: displayTitle,
		description,
		pubdate,
		url,
		useCorsProxy,
		hash: crypto.createHash("sha256").update(`${pubdate} :: ${title} :: ${url}`).digest("hex")
	};
};

module.exports = {
	sanitizeBasicHtml,
	normalizeFeedItem
};
