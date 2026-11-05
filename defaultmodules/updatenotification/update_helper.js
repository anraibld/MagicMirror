const Exec = require("node:child_process").exec;
const Spawn = require("node:child_process").spawn;

const Log = require("logger");

class Updater {
	constructor (config) {
		this.updates = config.updates;
		this.timeout = config.updateTimeout;
		this.autoRestart = config.updateAutorestart;
		this.moduleList = {};
		this.updating = false;
		this.version = global.version;
		this.root_path = global.root_path;
		Log.info("Updater Class Loaded!");
	}

	async parse (modules) {
		var parser = modules.map(async (module) => {
			if (this.moduleList[module.module] === undefined) {
				this.moduleList[module.module] = {};
				this.moduleList[module.module].name = module.module;
				this.moduleList[module.module].updateCommand = await this.applyCommand(module.module);
				this.moduleList[module.module].inProgress = false;
				this.moduleList[module.module].error = null;
				this.moduleList[module.module].updated = false;
				this.moduleList[module.module].needRestart = false;
			}
			if (!this.moduleList[module.module].inProgress) {
				if (!this.updating) {
					if (!this.moduleList[module.module].updateCommand) {
						this.updating = false;
					} else {
						this.updating = true;
						this.moduleList[module.module].inProgress = true;
						Object.assign(this.moduleList[module.module], await this.updateProcess(this.moduleList[module.module]));
					}
				}
			}
		});

		await Promise.all(parser);
		const updater = Object.values(this.moduleList);
		Log.debug("Update Result:", updater);
		return updater;
	}

	updateProcess (module) {
		const Result = {
			error: false,
			updated: false,
			needRestart: false
		};
		let Command = null;
		const Path = `${this.root_path}/modules/`;
		const modulePath = Path + module.name;

		if (module.updateCommand) {
			Command = module.updateCommand;
		} else {
			Log.warn(`Update of ${module.name} is not supported.`);
			return Result;
		}
		Log.info(`Updating ${module.name}...`);

		return new Promise((resolve) => {
			Exec(Command, { cwd: modulePath, timeout: this.timeout }, (error, stdout) => {
				if (error) {
					Log.error(`exec error: ${error}`);
					Result.error = true;
				} else {
					Log.info(`Update logs of ${module.name}: ${stdout}`);
					Result.updated = true;
					if (this.autoRestart) {
						Log.info("Update done");
						setTimeout(() => this.nodeRestart(), 3000);
					} else {
						Log.info("Update done, don't forget to restart MagicMirror!");
						Result.needRestart = true;
					}
				}
				resolve(Result);
			});
		});
	}

	nodeRestart () {
		Log.info("Restarting MagicMirror...");

		const isManagedByPm2 = process.env.pm_id !== undefined;
		if (isManagedByPm2) {
			Log.info("Running under PM2 — exiting for PM2 to respawn.");
			process.exit(0);
			return;
		}

		this._spawnDetachedSelf();
		process.exit();
	}

	_spawnDetachedSelf () {
		const nodeBinary = process.argv[0];
		const nodeArgs = process.argv.slice(1);
		const spawnOptions = {
			cwd: this.root_path,
			detached: true,
			stdio: ["ignore", process.stdout, process.stderr]
		};

		const child = Spawn(nodeBinary, nodeArgs, spawnOptions);
		child.unref();
	}

	isMagicMirror (module) {
		if (module === "MagicMirror") return true;
		return false;
	}

	applyCommand (module) {
		if (this.isMagicMirror(module.module) || !this.updates.length) return null;
		let command = null;
		this.updates.forEach((updater) => {
			if (updater[module]) command = updater[module];
		});
		return command;
	}
}

module.exports = Updater;
