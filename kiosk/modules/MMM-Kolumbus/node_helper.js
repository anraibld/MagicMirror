const NodeHelper = require("node_helper");

const URL = "https://api.entur.io/journey-planner/v3/graphql";

function buildQuery(id, n) {
	return `{ stopPlace(id: ${JSON.stringify(id)}) { name estimatedCalls(numberOfDepartures: ${parseInt(n, 10)}, timeRange: 86400) { expectedDepartureTime aimedDepartureTime realtime destinationDisplay { frontText } serviceJourney { line { publicCode } } quay { publicCode } } } }`;
}

async function fetchDepartures(id, n) {
	const res = await fetch(URL, {
		method: "POST",
		headers: { "Content-Type": "application/json", "ET-Client-Name": "anraibld-magicmirror" },
		body: JSON.stringify({ query: buildQuery(id, n) })
	});
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const json = await res.json();
	if (json.errors) throw new Error(json.errors[0].message);
	const sp = json.data && json.data.stopPlace;
	if (!sp) throw new Error("Fant ikke stoppested");
	return {
		name: sp.name,
		departures: sp.estimatedCalls.map((c) => ({
			line: c.serviceJourney.line.publicCode,
			destination: c.destinationDisplay.frontText,
			quay: c.quay && c.quay.publicCode,
			expected: c.expectedDepartureTime,
			aimed: c.aimedDepartureTime,
			realtime: !!c.realtime
		}))
	};
}

module.exports = NodeHelper.create({
	socketNotificationReceived(notification, payload) {
		if (notification !== "KOLUMBUS_FETCH") return;
		// fetch extra so lineFilter still leaves enough rows
		const n = payload.lineFilter && payload.lineFilter.length ? payload.maxDepartures * 6 : payload.maxDepartures;
		fetchDepartures(payload.stopPlaceId, n)
			.then((data) => this.sendSocketNotification("KOLUMBUS_DATA", { identifier: payload.identifier, ...data }))
			.catch((e) => this.sendSocketNotification("KOLUMBUS_ERROR", { identifier: payload.identifier, message: e.message }));
	},
	fetchDepartures,
	buildQuery
});
