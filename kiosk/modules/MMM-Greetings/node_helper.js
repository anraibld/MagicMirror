const NodeHelper = require("node_helper");
const fs = require("fs");
const path = require("path");

module.exports = NodeHelper.create({
  watching: {},

  resolve(file) {
    if (file.startsWith("~")) file = path.join(process.env.HOME || "", file.slice(1));
    return path.isAbsolute(file) ? file : path.resolve(global.root_path, file);
  },

  parse(fp) {
    const buckets = { anytime: [], morning: [], afternoon: [], evening: [] };
    let section = "anytime";
    let text = "";
    try { text = fs.readFileSync(fp, "utf8"); } catch (e) { return buckets; }
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      if (line.startsWith("##")) {
        const name = line.replace(/^#+/, "").trim().toLowerCase();
        section = buckets[name] ? name : "anytime";
        continue;
      }
      if (line.startsWith("#") || line.startsWith("//")) continue;
      buckets[section].push(line);
    }
    return buckets;
  },

  send(fp) { this.sendSocketNotification("GREET_DATA", this.parse(fp)); },

  socketNotificationReceived(n, p) {
    if (n !== "GREET_INIT") return;
    const fp = this.resolve(p.file);
    this.send(fp);
    if (this.watching[fp]) return;
    this.watching[fp] = true;
    // watch the directory so atomic-save editors (nano/vi) still trigger reloads
    try {
      let t = null;
      fs.watch(path.dirname(fp), (ev, fn) => {
        if (fn && fn !== path.basename(fp)) return;
        clearTimeout(t);
        t = setTimeout(() => { console.log("[MMM-Greetings] reloaded " + fp); this.send(fp); }, 200);
      });
    } catch (e) { console.error("[MMM-Greetings] watch failed:", e.message); }
  }
});
