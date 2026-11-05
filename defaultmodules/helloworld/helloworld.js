Module.register("helloworld", {
	defaults: {
		text: "Hello World!"
	},

	getTemplate () {
		return "helloworld.njk";
	},

	getTemplateData () {
		return this.config;
	}
});
