const util = require("node:util");
const execFile = util.promisify(require("node:child_process").execFile);
const fs = require("node:fs");
const path = require("node:path");
const Log = require("logger");

class GitHelper {
	constructor () {
		this.gitRepos = [];
		this.gitResultList = [];
	}

	getRefDiffFromFetchDryRun (fetchOutput, currentBranch) {
		const fallbackRefDiff = `${currentBranch}..origin/${currentBranch}`;

		for (const line of fetchOutput.split("\n")) {
			const columns = line.trim().split(/\s+/);
			const [refDiff, branchName] = columns;

			if (branchName === currentBranch && refDiff?.includes("..")) {
				return refDiff;
			}
		}

		return fallbackRefDiff;
	}

	async execGit (moduleFolder, ...args) {
		const { stdout = "", stderr = "" } = await execFile("git", args, { cwd: moduleFolder });

		return { stdout, stderr };
	}

	async isGitRepo (moduleFolder) {
		const { stderr } = await this.execGit(moduleFolder, "remote", "-v");

		if (stderr) {
			Log.error(`Failed to fetch git data for ${moduleFolder}: ${stderr}`);

			return false;
		}

		return true;
	}

	async add (moduleName) {
		let moduleFolder = `${global.root_path}`;

		if (moduleName !== "MagicMirror") {
			moduleFolder = `${moduleFolder}/modules/${moduleName}`;
		}

		try {
			Log.info(`Checking git for module: ${moduleName}`);
			fs.statSync(path.join(moduleFolder, ".git"));

			const isGitRepo = await this.isGitRepo(moduleFolder);

			if (isGitRepo) {
				this.gitRepos.push({ module: moduleName, folder: moduleFolder });
			}
		} catch {
		}
	}

	async getStatusInfo (repo) {
		const gitInfo = {
			module: repo.module,
			behind: 0,
			current: "",
			hash: "",
			tracking: "",
			isBehindInStatus: false
		};

		if (repo.module === "MagicMirror") {
			const { stderr, stdout } = await this.execGit(repo.folder, "rev-parse", "HEAD");

			if (stderr) {
				Log.error(`Failed to get current commit hash for ${repo.module}: ${stderr}`);
			}

			gitInfo.hash = stdout;
		}

		const { stderr, stdout } = await this.execGit(repo.folder, "status", "-sb");

		if (stderr) {
			Log.error(`Failed to get git status for ${repo.module}: ${stderr}`);
			return;
		}

		let status = stdout.split("\n")[0];
		status = status.match(/## (.*)\.\.\.([^ ]*)(?: .*behind (\d+))?/);
		if (status) {
			gitInfo.current = status[1];
			gitInfo.tracking = status[2];

			if (status[3]) {
				gitInfo.behind = parseInt(status[3]);
				gitInfo.isBehindInStatus = true;
			}
		}

		return gitInfo;
	}

	async getRepoInfo (repo) {
		const gitInfo = await this.getStatusInfo(repo);

		if (!gitInfo || !gitInfo.current) {
			return;
		}

		if (gitInfo.isBehindInStatus && (gitInfo.module !== "MagicMirror" || gitInfo.current !== "master")) {
			return gitInfo;
		}

		const { stderr } = await this.execGit(repo.folder, "fetch", "-n", "--dry-run");

		const refDiff = this.getRefDiffFromFetchDryRun(stderr, gitInfo.current);

		try {
			const { stdout } = await this.execGit(repo.folder, "rev-list", "--ancestry-path", "--count", refDiff);
			gitInfo.behind = parseInt(stdout);

			if (gitInfo.behind > 0 && gitInfo.module === "MagicMirror" && gitInfo.current === "master") {
				let tagList = "";
				try {
					const { stdout } = await this.execGit(repo.folder, "ls-remote", "-q", "--tags", "--refs");
					tagList = stdout.trim();
				} catch (err) {
					Log.error(`Failed to get tag list for ${repo.module}: ${err}`);
				}
				try {
					const { stdout } = await this.execGit(repo.folder, "rev-list", "--ancestry-path", refDiff);
					let cnt = 0;
					for (const ref of stdout.trim().split("\n")) {
						if (tagList.includes(ref)) cnt++;
					}
					if (cnt === 0) gitInfo.behind = 0;
				} catch (err) {
					Log.error(`Failed to get git revisions for ${repo.module}: ${err}`);
				}
			}

			return gitInfo;
		} catch (err) {
			Log.error(`Failed to get git revisions for ${repo.module}: ${err}`);
		}
	}

	async getRepos () {
		this.gitResultList = [];

		for (const repo of this.gitRepos) {
			try {
				const gitInfo = await this.getRepoInfo(repo);

				if (gitInfo) {
					this.gitResultList.push(gitInfo);
				}
			} catch (e) {
				if (process.env.mmTestMode !== "true") {
					Log.error(`Failed to retrieve repo info for ${repo.module}: ${e}`);
				}
			}
		}

		return this.gitResultList;
	}

	checkUpdates () {
		const updates = [];

		for (const moduleInfo of this.gitResultList) {
			if (moduleInfo.behind > 0 && moduleInfo.module !== "MagicMirror") {
				Log.info(`Update found for module: ${moduleInfo.module}`);
				updates.push(moduleInfo);
			}
		}

		return updates;
	}
}

module.exports = GitHelper;
