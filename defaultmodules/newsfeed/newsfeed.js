Module.register("newsfeed", {
	defaults: {
		feeds: [
			{
				title: "New York Times",
				url: "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
				encoding: "UTF-8"
			}
		],
		showAsList: false,
		showSourceTitle: true,
		showPublishDate: true,
		broadcastNewsFeeds: true,
		broadcastNewsUpdates: true,
		showDescription: false,
		showTitleAsUrl: false,
		wrapTitle: true,
		wrapDescription: true,
		truncDescription: true,
		lengthDescription: 400,
		hideLoading: false,
		reloadInterval: 5 * 60 * 1000,
		updateInterval: 10 * 1000,
		animationSpeed: 2.5 * 1000,
		maxNewsItems: 0,
		ignoreOldItems: false,
		ignoreOlderThan: 24 * 60 * 60 * 1000,
		removeStartTags: "",
		removeEndTags: "",
		startTags: [],
		endTags: [],
		prohibitedWords: [],
		scrollLength: 500,
		logFeedWarnings: false,
		dangerouslyDisableAutoEscaping: false,
		allowedBasicHtmlTags: []
	},

	getScripts () {
		return ["moment.js"];
	},

	getStyles () {
		return ["newsfeed.css"];
	},

	getTranslations () {
		return false;
	},

	start () {
		Log.info(`Starting module: ${this.name}`);

		moment.locale(globalThis.config.language);

		this.newsItems = [];
		this.loaded = false;
		this.error = null;
		this.activeItem = 0;
		this.scrollPosition = 0;
		this.articleIframe = null;
		this.articleContainer = null;
		this.articleFrameCheckPending = false;
		this.articleUnavailable = false;

		this.registerFeeds();

		this.isShowingDescription = this.config.showDescription;
	},

	socketNotificationReceived (notification, payload) {
		if (notification === "NEWS_ITEMS") {
			this.generateFeed(payload);

			if (!this.loaded) {
				if (this.config.hideLoading) {
					this.show();
				}
				this.scheduleUpdateInterval();
			}

			this.loaded = true;
			this.error = null;
		} else if (notification === "NEWSFEED_ERROR") {
			this.error = this.translate(payload.error_type);
			this.scheduleUpdateInterval();
		} else if (notification === "ARTICLE_URL_STATUS") {
			if (this.config.showFullArticle) {
				this.articleFrameCheckPending = false;
				this.articleUnavailable = !payload.canFrame;
				if (!this.articleUnavailable) {
					document.getElementsByClassName("region bottom bar")[0].classList.add("newsfeed-fullarticle");
				}
				this.updateDom(100);
				if (this.articleUnavailable) {
					setTimeout(() => {
						this.resetDescrOrFullArticleAndTimer();
						this.updateDom(500);
					}, 3000);
				}
			}
		}
	},

	getDom () {
		if (this.config.showFullArticle) {
			this.activeItemHash = this.newsItems[this.activeItem]?.hash;
			const wrapper = document.createElement("div");
			if (this.articleFrameCheckPending) {
				wrapper.innerHTML = `<div class="small dimmed">${this.translate("LOADING")}</div>`;
			} else if (this.articleUnavailable) {
				wrapper.innerHTML = `<div class="small dimmed">${this.translate("NEWSFEED_ARTICLE_UNAVAILABLE")}</div>`;
			} else {
				const container = document.createElement("div");
				container.className = "newsfeed-fullarticle-container";
				container.scrollTop = this.scrollPosition;
				const iframe = document.createElement("iframe");
				iframe.className = "newsfeed-fullarticle";
				const item = this.newsItems[this.activeItem];
				iframe.src = item ? (typeof item.url === "string" ? item.url : item.url.href) : "";
				this.articleIframe = iframe;
				this.articleContainer = container;
				container.appendChild(iframe);
				wrapper.appendChild(container);
			}
			return Promise.resolve(wrapper);
		}
		return Module.prototype.getDom.call(this);
	},

	getTemplate () {
		if (this.config.feedUrl) {
			return "oldconfig.njk";
		}
		return "newsfeed.njk";
	},

	getTemplateData () {
		if (this.activeItem >= this.newsItems.length) {
			this.activeItem = 0;
		}
		this.activeItemCount = this.newsItems.length;
		if (this.error) {
			this.activeItemHash = undefined;
			return {
				error: this.error
			};
		}
		if (this.newsItems.length === 0) {
			this.activeItemHash = undefined;
			return {
				empty: true
			};
		}

		const item = this.newsItems[this.activeItem];
		this.activeItemHash = item.hash;

		const items = this.newsItems.map((item) => {
			item.publishDate = moment(new Date(item.pubdate)).fromNow();
			return item;
		});

		return {
			loaded: true,
			config: this.config,
			sourceTitle: item.sourceTitle,
			publishDate: moment(new Date(item.pubdate)).fromNow(),
			title: item.title,
			url: this.getActiveItemURL(),
			description: item.description,
			items: items
		};
	},

	getActiveItemURL () {
		const item = this.newsItems[this.activeItem];
		if (item) {
			return typeof item.url === "string" ? item.url : item.url.href;
		} else {
			return "";
		}
	},

	registerFeeds () {
		for (const feed of this.config.feeds) {
			this.sendSocketNotification("ADD_FEED", {
				feed: feed,
				config: this.config
			});
		}
	},

	getFeedProperty (feed, property) {
		let res = this.config[property];
		const f = this.config.feeds.find((feedItem) => feedItem.url === feed);
		if (f && f[property]) res = f[property];
		return res;
	},

	generateFeed (feeds) {
		let newsItems = [];
		for (const feed in feeds) {
			const feedItems = feeds[feed];
			if (this.subscribedToFeed(feed)) {
				for (const item of feedItems) {
					item.sourceTitle = this.titleForFeed(feed);
					if (!(this.getFeedProperty(feed, "ignoreOldItems") && Date.now() - new Date(item.pubdate) > this.getFeedProperty(feed, "ignoreOlderThan"))) {
						newsItems.push(item);
					}
				}
			}
		}
		newsItems.sort((a, b) => {
			const dateA = new Date(a.pubdate);
			const dateB = new Date(b.pubdate);
			return dateB - dateA;
		});

		if (this.config.maxNewsItems > 0) {
			newsItems = newsItems.slice(0, this.config.maxNewsItems);
		}

		if (this.config.prohibitedWords.length > 0) {
			newsItems = newsItems.filter((item) => {
				for (const word of this.config.prohibitedWords) {
					if (item.title.toLowerCase().indexOf(word.toLowerCase()) > -1) {
						return false;
					}
				}
				return true;
			}, this);
		}
		newsItems.forEach((item) => {
			if (this.config.removeStartTags === "title" || this.config.removeStartTags === "both") {
				for (const startTag of this.config.startTags) {
					if (item.title.slice(0, startTag.length) === startTag) {
						item.title = item.title.slice(startTag.length, item.title.length);
					}
				}
			}

			if (this.config.removeStartTags === "description" || this.config.removeStartTags === "both") {
				if (this.isShowingDescription) {
					for (const startTag of this.config.startTags) {
						if (item.description.slice(0, startTag.length) === startTag) {
							item.description = item.description.slice(startTag.length, item.description.length);
						}
					}
				}
			}

			if (this.config.removeEndTags) {
				for (const endTag of this.config.endTags) {
					if (item.title.slice(-endTag.length) === endTag) {
						item.title = item.title.slice(0, -endTag.length);
					}
				}

				if (this.isShowingDescription) {
					for (const endTag of this.config.endTags) {
						if (item.description.slice(-endTag.length) === endTag) {
							item.description = item.description.slice(0, -endTag.length);
						}
					}
				}
			}
		});

		const updatedItems = [];
		newsItems.forEach((value) => {
			if (this.newsItems.findIndex((value1) => value1 === value) === -1) {
				updatedItems.push(value);
			}
		});

		if (this.config.broadcastNewsUpdates && updatedItems.length > 0) {
			this.sendNotification("NEWS_FEED_UPDATE", { items: updatedItems });
		}

		this.newsItems = newsItems;
	},

	subscribedToFeed (feedUrl) {
		for (const feed of this.config.feeds) {
			if (feed.url === feedUrl) {
				return true;
			}
		}
		return false;
	},

	titleForFeed (feedUrl) {
		for (const feed of this.config.feeds) {
			if (feed.url === feedUrl) {
				return feed.title || "";
			}
		}
		return "";
	},

	scheduleUpdateInterval () {
		this.updateDom(this.config.animationSpeed);

		if (this.config.broadcastNewsFeeds) {
			this.sendNotification("NEWS_FEED", { items: this.newsItems });
		}

		if (this.timer) clearInterval(this.timer);

		this.timer = setInterval(() => {

			if (this.newsItems.length > 1 || this.newsItems.length !== this.activeItemCount || this.activeItemHash !== this.newsItems[0]?.hash) {
				this.activeItem++;
				this.updateDom(this.config.animationSpeed);
			}

			if (this.config.broadcastNewsFeeds) {
				this.sendNotification("NEWS_FEED", { items: this.newsItems });
			}
		}, this.config.updateInterval);
	},

	resetDescrOrFullArticleAndTimer () {
		this.isShowingDescription = this.config.showDescription;
		this.config.showFullArticle = false;
		this.scrollPosition = 0;
		this.articleIframe = null;
		this.articleContainer = null;
		this.articleFrameCheckPending = false;
		this.articleUnavailable = false;
		document.getElementsByClassName("region bottom bar")[0].classList.remove("newsfeed-fullarticle");
		if (!this.timer) {
			this.scheduleUpdateInterval();
		}
	},

	notificationReceived (notification) {
		const before = this.activeItem;
		if (notification === "MODULE_DOM_CREATED" && this.config.hideLoading) {
			this.hide();
		} else if (notification === "ARTICLE_NEXT") {
			this.activeItem++;
			if (this.activeItem >= this.newsItems.length) {
				this.activeItem = 0;
			}
			this.resetDescrOrFullArticleAndTimer();
			Log.debug(`[newsfeed] going from article #${before} to #${this.activeItem} (of ${this.newsItems.length})`);
			this.updateDom(100);
		} else if (notification === "ARTICLE_PREVIOUS") {
			this.activeItem--;
			if (this.activeItem < 0) {
				this.activeItem = this.newsItems.length - 1;
			}
			this.resetDescrOrFullArticleAndTimer();
			Log.debug(`[newsfeed] going from article #${before} to #${this.activeItem} (of ${this.newsItems.length})`);
			this.updateDom(100);
		}
		else if (notification === "ARTICLE_MORE_DETAILS") {
			if (this.config.showFullArticle === true) {
				this.scrollPosition += this.config.scrollLength;
				if (this.articleContainer) this.articleContainer.scrollTop = this.scrollPosition;
				Log.debug(`[newsfeed] scrolling down, offset: ${this.scrollPosition}`);
			} else if (this.isShowingDescription) {
				this.showFullArticle();
			} else {
				this.isShowingDescription = true;
				Log.debug("[newsfeed] showing article description");
				this.updateDom(100);
			}
		} else if (notification === "ARTICLE_SCROLL_UP") {
			if (this.config.showFullArticle === true) {
				this.scrollPosition = Math.max(0, this.scrollPosition - this.config.scrollLength);
				if (this.articleContainer) this.articleContainer.scrollTop = this.scrollPosition;
				Log.debug(`[newsfeed] scrolling up, offset: ${this.scrollPosition}`);
			}
		} else if (notification === "ARTICLE_LESS_DETAILS") {
			this.resetDescrOrFullArticleAndTimer();
			Log.debug("[newsfeed] showing only article titles again");
			this.updateDom(100);
		} else if (notification === "ARTICLE_TOGGLE_FULL") {
			if (this.config.showFullArticle) {
				this.activeItem++;
				this.resetDescrOrFullArticleAndTimer();
			} else {
				this.showFullArticle();
			}
		} else if (notification === "ARTICLE_INFO_REQUEST") {
			const infoItem = this.newsItems[this.activeItem];
			if (infoItem) {
				this.sendNotification("ARTICLE_INFO_RESPONSE", {
					title: infoItem.title,
					source: infoItem.sourceTitle,
					date: infoItem.pubdate,
					desc: infoItem.description,
					url: typeof infoItem.url === "string" ? infoItem.url : infoItem.url.href
				});
			}
		}
	},

	showFullArticle () {
		const item = this.newsItems[this.activeItem];
		const hasUrl = item && item.url && (typeof item.url === "string" ? item.url : item.url.href);
		if (!hasUrl) {
			Log.debug("[newsfeed] no article URL available, skipping full article view");
			return;
		}
		this.isShowingDescription = false;
		this.config.showFullArticle = true;
		this.articleFrameCheckPending = true;
		this.articleUnavailable = false;
		const rawUrl = typeof item.url === "string" ? item.url : item.url.href;
		this.sendSocketNotification("CHECK_ARTICLE_URL", { url: rawUrl });
		clearInterval(this.timer);
		this.timer = null;
		Log.debug("[newsfeed] showing full article");
		this.updateDom(100);
	}
});
