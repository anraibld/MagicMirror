Module.register("MMM-Greetings", {
  defaults: {
    file: "greetings.md",
    updateInterval: 30000,
    fadeSpeed: 4000,
    random: true,
    morningStartTime: 3,
    morningEndTime: 12,
    afternoonStartTime: 12,
    afternoonEndTime: 17
  },

  buckets: { anytime: [], morning: [], afternoon: [], evening: [] },
  lastIndex: -1,

  start() {
    this.sendSocketNotification("GREET_INIT", { file: this.config.file });
    setInterval(() => this.updateDom(this.config.fadeSpeed), this.config.updateInterval);
  },

  socketNotificationReceived(n, p) {
    if (n === "GREET_DATA") {
      this.buckets = p;
      this.lastIndex = -1;
      this.updateDom(this.config.fadeSpeed);
    }
  },

  pick(list) {
    if (!list.length) return "";
    if (!this.config.random) { this.lastIndex = (this.lastIndex + 1) % list.length; return list[this.lastIndex]; }
    if (list.length === 1) return list[0];
    let g;
    do { g = Math.floor(Math.random() * list.length); } while (g === this.lastIndex);
    this.lastIndex = g;
    return list[g];
  },

  currentList() {
    const h = new Date().getHours();
    const b = this.buckets;
    let list = (b.anytime || []).slice();
    if (h >= this.config.morningStartTime && h < this.config.morningEndTime) list = list.concat(b.morning || []);
    else if (h >= this.config.afternoonStartTime && h < this.config.afternoonEndTime) list = list.concat(b.afternoon || []);
    else list = list.concat(b.evening || []);
    return list;
  },

  getDom() {
    const wrapper = document.createElement("div");
    wrapper.className = "thin xlarge bright pre-line";
    wrapper.innerHTML = this.pick(this.currentList());
    return wrapper;
  }
});
