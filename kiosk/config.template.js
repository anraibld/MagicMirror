/* MagicMirror² config – Stavanger, YR, pages.
 * NB: this file is gitignored (contains WiFi password + Spotify keys). */
let config = {
	address: "0.0.0.0", // needed for MMM-Remote-Control from phone
	port: 8080,
	basePath: "/",
	ipWhitelist: ["127.0.0.1", "::ffff:127.0.0.1", "::1", "192.168.0.0/16", "::ffff:192.168.0.0/16", "10.0.0.0/8", "::ffff:10.0.0.0/8"],

	useHttps: false,
	language: "nb",
	locale: "nb-NO",
	logLevel: ["INFO", "LOG", "WARN", "ERROR"],
	timeFormat: 24,
	units: "metric",

	modules: [
		// ---------- Faste (vises alltid) ----------
		{ module: "alert" },
		{ module: "MMM-Remote-Control", position: "bottom_left", config: { showQRCode: true } },
		{ module: "MMM-MagicMover", config: { updateInterval: 10 * 60 * 1000, maxMove: 15 } }, // mot innbrenning
		{ module: "MMM-WeatherEffects", position: "fullscreen_above" },
		{ module: "clock", position: "top_left" },
		{
			module: "weather",
			position: "top_right",
			config: {
				weatherProvider: "yrno",
				type: "current",
				lat: 58.97,
				lon: 5.7331, // Stavanger
				location: "Stavanger"
			}
		},
		{
			module: "weather",
			position: "top_right",
			header: "Værmelding Stavanger",
			config: { weatherProvider: "yrno", type: "forecast", lat: 58.97, lon: 5.7331, maxNumberOfDays: 5, colored: true }
		},
		{
			module: "compliments",
			position: "lower_third",
			config: {
				compliments: {
					anytime: ["Hei, du!", "Du ser bra ut!"],
					morning: ["God morgen!", "Ha en fin dag!", "Kaffe først."],
					afternoon: ["God ettermiddag!", "Du får til dette!"],
					evening: ["God kveld!", "Tid for å slappe av."]
				}
			}
		},
		{
			module: "MMM-WiFiPassword",
			position: "bottom_left",
			config: { network: "BYTT-MEG", password: "BYTT-MEG", authType: "WPA", header: "WiFi", qrSize: 100, layoutVertical: false }
		},
		{
			module: "MMM-OnSpotify",
			position: "bottom_right",
			config: {
				// TODO: fyll inn fra Spotify-appen din / MMM-OnSpotify-oppsettet
				clientID: "key",
				clientSecret: "key",
				accessToken: "key",
				refreshToken: "key"
			}
		},
		{
			module: "MMM-pages",
			config: {
				timings: { default: 20000 },
				modules: [
					["MMM-Kolumbus", "MMM-GoogleCast"], // side 0
					["MMM-MyScoreboard", "MMM-MyStandings"], // side 1
					["newsfeed", "MMM-Farevarsel"] // side 2
				],
				fixed: [
					"alert", "MMM-Remote-Control", "MMM-MagicMover", "MMM-WeatherEffects", "clock", "weather",
					"compliments", "MMM-WiFiPassword", "MMM-OnSpotify", "MMM-page-indicator"
				]
			}
		},
		{ module: "MMM-page-indicator", position: "bottom_bar", config: { pages: 3, activeBright: true } },

		// ---------- Side 0: transport + Cast ----------
		{ module: "MMM-Kolumbus", position: "top_left", header: "Buss – Kolumbus", config: { maxDepartures: 8 } },
		{
			module: "MMM-GoogleCast",
			position: "middle_center",
			config: { device: "PASTE-DEVICE-ID-HER", hide: true } // TODO: enhets-ID (se README)
		},

		// ---------- Side 1: fotball ----------
		{
			module: "MMM-MyScoreboard",
			position: "top_left",
			config: {
				viewStyle: "stackedWithLogos",
				sports: [
					{ league: "NOR_ELITESERIEN", teams: ["VFK"] },
					{ league: "English Premier League", teams: ["MAN"] },
					{ league: "UEFA_CHAMPIONS", teams: ["MAN"] },
					{ league: "FIFA_WORLD_CUP" }
				]
			}
		},
		{
			module: "MMM-MyStandings",
			position: "top_right",
			config: { rotateInterval: 30 * 1000, sports: [{ league: "English Premier League" }] }
		},

		// ---------- Side 2: nyheter + farevarsel ----------
		{ module: "MMM-Farevarsel", position: "top_bar", config: { county: "11", colorBackground: true } },
		{
			module: "newsfeed",
			position: "bottom_bar",
			config: {
				feeds: [{ title: "Aftenbladet", url: "https://www.aftenbladet.no/rss" }],
				showSourceTitle: true,
				showPublishDate: true,
				broadcastNewsFeeds: true,
				broadcastNewsUpdates: true
			}
		}
	]
};

/*************** DO NOT EDIT THE LINE BELOW ***************/
if (typeof module !== "undefined") { module.exports = config; }
