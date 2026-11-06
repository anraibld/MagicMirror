const SPOTIFY = { clientID: "", clientSecret: "", accessToken: "", refreshToken: "" };
const CAST_DEVICE = "";

let config = {
	address: "0.0.0.0",
	port: 8080,
	basePath: "/",
	ipWhitelist: ["127.0.0.1", "::ffff:127.0.0.1", "::1", "192.168.0.0/16", "::ffff:192.168.0.0/16", "10.0.0.0/8", "::ffff:10.0.0.0/8"],

	useHttps: false,
	language: "nb",
	locale: "nb-NO",
	logLevel: ["INFO", "LOG", "WARN", "ERROR"],
	timeFormat: 24,
	units: "metric",
	reloadAfterServerRestart: true,
	checkServerInterval: 10000,

	modules: [
		{ module: "alert" },
		{ module: "MMM-Remote-Control", position: "bottom_left", config: { showQRCode: false } },
		{ module: "MMM-MagicMover", config: { updateInterval: 10 * 60 * 1000, maxMove: 15 } },
		{ module: "MMM-WeatherEffects", position: "fullscreen_above" },
		{ module: "clock", position: "top_left" },
		{
			module: "weather",
			position: "top_right",
			config: {
				weatherProvider: "yr",
				type: "current",
				lat: 58.97,
				lon: 5.7331,
				location: "Stavanger"
			}
		},
		{
			module: "weather",
			position: "top_right",
			header: "Værmelding Stavanger",
			config: { weatherProvider: "yr", type: "forecast", lat: 58.97, lon: 5.7331, maxNumberOfDays: 5, colored: true }
		},
		{ module: "MMM-Greetings", position: "lower_third", config: { file: "greetings.md" } },
		{
			module: "MMM-pages",
			config: {
				timings: { default: 20000 },
				modules: [
					["MMM-Kolumbus", "MMM-GoogleCast", "MMM-WiFiPassword"],
					["MMM-MyScoreboard", "MMM-MyStandings"],
					["newsfeed", "MMM-Farevarsel"]
				],
				fixed: [
					"alert", "MMM-Remote-Control", "MMM-MagicMover", "MMM-WeatherEffects", "clock", "weather",
					"MMM-Greetings", "MMM-OnSpotify", "MMM-page-indicator"
				]
			}
		},
		{
			module: "MMM-OnSpotify",
			position: "bottom_right",
			disabled: !SPOTIFY.clientID,
			config: { ...SPOTIFY }
		},
		{
			module: "MMM-WiFiPassword",
			position: "bottom_left",
			config: { network: "BYTT-MEG", password: "BYTT-MEG", authType: "WPA", header: "Gjesten-WiFi", qrSize: 110, layoutVertical: false, colorDark: "#000000", colorLight: "#ffffff" }
		},
		{ module: "MMM-page-indicator", position: "bottom_bar", config: { pages: 3, activeBright: true } },

		{
			module: "MMM-Kolumbus",
			position: "top_left",
			header: "Busser fra Rosenli",
			config: { stopPlaceId: "NSR:StopPlace:25861", modes: ["bus"], maxDepartures: 6 }
		},
		{
			module: "MMM-Kolumbus",
			position: "top_left",
			header: "Tog fra Stavanger",
			config: { stopPlaceId: "NSR:StopPlace:61291", modes: ["rail"], maxDepartures: 5, showPlatform: true }
		},
		{ module: "MMM-GoogleCast", position: "middle_center", disabled: !CAST_DEVICE, config: { device: CAST_DEVICE, hide: true } },

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

if (typeof module !== "undefined") { module.exports = config; }
