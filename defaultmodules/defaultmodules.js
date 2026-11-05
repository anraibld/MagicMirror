const defaultModules = ["alert", "calendar", "clock", "compliments", "helloworld", "newsfeed", "updatenotification", "weather"];

globalThis.defaultModules = defaultModules;

if (typeof module !== "undefined") {
	module.exports = defaultModules;
}
