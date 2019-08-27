const ora = require('ora');
const fs = require('fs');
const ejs = require('ejs');
const path = require('path');
const ghGot = require('gh-got');
const chalk = require('chalk');
const { promisify } = require('util');
const unescape = require('lodash.unescape');
const isObject = require('validate.io-object');
const isString = require('validate.io-string-primitive');
const isBoolean = require('validate.io-boolean-primitive');

const options = {};

const validate = _options => {
	if (!isObject(_options)) {
		return new TypeError(`invalid input argument. Options argument must be an object. Value: \`${_options}\`.`);
	}
	if (
		Object.prototype.hasOwnProperty.call(_options, 'username') ||
		Object.prototype.hasOwnProperty.call(_options, 'u')
	) {
		options.username = _options.username || _options.u;
		if (!isString(options.username)) {
			return new TypeError(`invalid option. Username must be a string primitive.`);
		}
	}
	if (
		Object.prototype.hasOwnProperty.call(_options, 'token') ||
		Object.prototype.hasOwnProperty.call(_options, 't')
	) {
		options.token = _options.token || _options.t;
		if (!isString(options.token)) {
			return new TypeError(`invalid option. Token must be a string primitive.`);
		}
	}
	if (Object.prototype.hasOwnProperty.call(_options, 'repo') || Object.prototype.hasOwnProperty.call(_options, 'r')) {
		options.repo = _options.repo || _options.r;
		if (!isString(options.repo)) {
			return new TypeError(`invalid option. Repo name must be a string primitive.`);
		}
	}
	if (
		Object.prototype.hasOwnProperty.call(_options, 'message') ||
		Object.prototype.hasOwnProperty.call(_options, 'm')
	) {
		options.message = _options.message || _options.m;
		if (!isString(options.message)) {
			return new TypeError(`invalid option. Commit message must be a string primitive.`);
		}
	}
	if (Object.prototype.hasOwnProperty.call(_options, 'sort') || Object.prototype.hasOwnProperty.call(_options, 's')) {
		options.sort = _options.sort || _options.s;
		if (!isBoolean(options.sort)) {
			return new TypeError(`invalid option. Sort option must be a boolean primitive.`);
		}
	}
	if (
		Object.prototype.hasOwnProperty.call(_options, 'version') ||
		Object.prototype.hasOwnProperty.call(_options, 'v')
	) {
		options.version = _options.version || _options.v;
		if (!isBoolean(options.version)) {
			return new TypeError(`invalid option. Version option must be a boolean primitive.`);
		}
	}
	if (Object.prototype.hasOwnProperty.call(_options, 'help') || Object.prototype.hasOwnProperty.call(_options, 'h')) {
		options.help = _options.help || _options.h;
		if (!isBoolean(options.help)) {
			return new TypeError(`invalid option. Help option must be a boolean primitive.`);
		}
	}
	return null;
};

/**
 *  Display Validation Errors
 */
const flashError = message => {
	console.error(chalk.bold.red(`✖ ${message}`));
	process.exit(1);
};

/**
 *  Escape symbol table
 */
const htmlEscapeTable = {
	'>': '&gt;',
	'<': '&lt;',
};

/**
 *  Replace special characters with escape code
 */
String.prototype.htmlEscape = function() {
	let escStr = this;
	Object.entries(htmlEscapeTable).map(([key, value]) => {
		return (escStr = escStr.replace(new RegExp(key, 'g'), value));
	});
	return escStr;
};

/**
 *  Read the template from markdown file
 */
const getReadmeTemplate = async () => {
	const spinner = ora('Loading README template').start();

	try {
		const template = await promisify(fs.readFile)(path.resolve(__dirname, './template.md'), 'utf8');
		spinner.succeed('README template loaded');
		return template;
	} catch (err) {
		spinner.fail('README template loading fail');
		flashError(err);
	}
};

/**
 *  Render out readme content
 */
const buildReadmeContent = async context => {
	const template = await getReadmeTemplate();
	return ejs.render(template, {
		...context,
	});
};

/**
 *  Write content to README.md
 */
const writeReadmeContent = async readmeContent => {
	const spinner = ora('Creating README').start();

	try {
		await promisify(fs.writeFile)('README.md', unescape(readmeContent));
		spinner.succeed('README created');
	} catch (err) {
		spinner.fail('README creation fail');
		flashError(err);
	}
	spinner.stop();
};

module.exports = _options => {
	const err = validate(_options);

	if (err) {
		flashError(err);
		return;
	}

	const { username, sort, help, version } = options;

	if (help) {
		// ToDo: Show the commands
		return;
	}

	if (version) {
		// ToDo: Show the version info
		return;
	}

	if (!username) {
		flashError('Error! username is a required field.');
		return;
	}

	/**
	 *  Trim whitespaces
	 */
	if (typeof String.prototype.trim === 'undefined') {
		String.prototype.trim = function() {
			return String(this).replace(/^\s+|\s+$/g, '');
		};
	}

	const url = `users/${username}/starred`;

	(async () => {
		let response = {};
		const stargazed = {};
		const spinner = ora('Fetching repositories').start();

		try {
			response = await ghGot(url, _options);
			spinner.succeed('Data fetch successfully completed!');
		} catch (err) {
			spinner.fail('Error while fetching data!');
			flashError(err);
			return;
		}

		spinner.stop();

		const { body } = response;

		/**
		 *  Parse and save object
		 */
		if (Array.isArray(body)) {
			body.map(item => {
				let { name, description, html_url, language } = item;
				language = language || 'Others';
				description = description ? description.htmlEscape().replace('\n', '') : '';
				if (!(language in stargazed)) {
					stargazed[language] = [];
				}
				stargazed[language].push([name, html_url, description.trim()]);
				return null;
			});
		}

		if (sort) {
			// ToDo: Sort the object
		}

		/**
		 *  Generate Language Index
		 */
		const languages = Object.keys(stargazed);
		const readmeContent = await buildReadmeContent({ languages, username, stargazed });

		/**
		 *  Write Readme Content
		 */
		await writeReadmeContent(readmeContent);
	})();
};
