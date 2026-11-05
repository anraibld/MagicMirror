Module.register("MMM-Kolumbus", {
	defaults: {
		stopPlaceId: "NSR:StopPlace:59853",
		maxDepartures: 8,
		updateInterval: 60 * 1000,
		lineFilter: [],
		modes: [],
		showPlatform: false,
		header: ""
	},

	getStyles() { return ["MMM-Kolumbus.css"]; },

	start() {
		this.data_ = null;
		this.error = null;
		this.loaded = false;
		this.refresh();
		setInterval(() => this.refresh(), this.config.updateInterval);
		setInterval(() => this.updateDom(), 30 * 1000);
	},

	refresh() {
		this.sendSocketNotification("KOLUMBUS_FETCH", {
			identifier: this.identifier,
			stopPlaceId: this.config.stopPlaceId,
			maxDepartures: this.config.maxDepartures,
			lineFilter: this.config.lineFilter,
			modes: this.config.modes
		});
	},

	socketNotificationReceived(n, p) {
		if (!p || p.identifier !== this.identifier) return;
		if (n === "KOLUMBUS_DATA") { this.data_ = p; this.error = null; this.loaded = true; this.updateDom(); }
		if (n === "KOLUMBUS_ERROR") { this.error = p.message; this.updateDom(); }
	},

	getHeader() {
		return (this.data && this.data.header) || this.config.header || (this.data_ && this.data_.name) || "Kolumbus";
	},

	rel(dep) {
		const mins = Math.round((new Date(dep.expected) - Date.now()) / 60000);
		if (mins <= 0) return "nå";
		if (mins >= 60) return new Date(dep.expected).toLocaleTimeString("nb-NO", { hour: "2-digit", minute: "2-digit" });
		return mins + " min";
	},

	getDom() {
		const w = document.createElement("div");
		w.className = "kolumbus small";
		if (!this.data_) {
			w.innerHTML = this.error ? "Feil: " + this.error : "Laster avganger …";
			return w;
		}
		const f = this.config.lineFilter.map(String);
		const deps = this.data_.departures
			.filter((d) => !f.length || f.includes(String(d.line)))
			.slice(0, this.config.maxDepartures);
		const t = document.createElement("table");
		if (!deps.length) {
			const r = t.insertRow(); const c = r.insertCell(); c.textContent = "Ingen avganger"; c.className = "dim";
		}
		deps.forEach((d) => {
			const r = t.insertRow();
			r.insertCell().className = "kol-line";
			r.cells[0].textContent = d.line;
			r.insertCell().textContent = d.destination;
			if (this.config.showPlatform) { const q = r.insertCell(); q.className = "kol-quay dim"; q.textContent = d.quay ? "spor " + d.quay : ""; }
			const c = r.insertCell();
			c.className = "kol-time" + (d.realtime ? " kol-rt" : "");
			c.textContent = this.rel(d);
			if (d.realtime) { const s = document.createElement("span"); s.className = "kol-dot"; s.title = "Sanntid"; c.appendChild(s); }
		});
		w.appendChild(t);
		if (this.error) {
			const e = document.createElement("div");
			e.className = "dim xsmall kol-err";
			e.textContent = "Kunne ikke oppdatere (" + this.error + ") – viser siste data";
			w.appendChild(e);
		}
		return w;
	}
});
