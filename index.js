'use strict';
const path = require('path');
const Vinyl = require('vinyl');
const PluginError = require('plugin-error');
const through = require('through2');
const Yazl = require('yazl');
const getStream = require('get-stream');

module.exports = (filename, options) => {
	if (!filename) {
		throw new PluginError('gulp-zip', '`filename` required');
	}

	options = {
		compress: true,
		...options
	};

	let firstFile;
	const zip = new Yazl.ZipFile();

	return through.obj((file, encoding, callback) => {
		if (!firstFile) {
			firstFile = file;
		}

		// Because Windows...
		const pathname = file.relative.replace(/\\/g, '/');

		if (!pathname) {
			callback();
			return;
		}

		if (file.isNull() && file.stat && file.stat.isDirectory && file.stat.isDirectory()) {
			zip.addEmptyDirectory(pathname, {
				mtime: options.modifiedTime || file.stat.mtime || new Date(),
				// Set executable bit on directories if any other bits are set for that user/group/all
				// Fixes creating unusable zip files on platforms that do not use an executable bit
				mode: file.stat.mode | (((file.stat.mode >> 1) | (file.stat.mode >> 2)) & 0o111)
			});
		} else {
			const stat = {
				compress: options.compress,
				mtime: options.modifiedTime || (file.stat ? file.stat.mtime : new Date()),
				mode: file.stat ? file.stat.mode : null
			};

			if (file.isStream()) {
				zip.addReadStream(file.contents, pathname, stat);
			}

			if (file.isBuffer()) {
				zip.addBuffer(file.contents, pathname, stat);
			}
		}

		callback();
	}, function (callback) {
		if (!firstFile) {
			callback();
			return;
		}

		(async () => {
			const data = await getStream.buffer(zip.outputStream);

			this.push(new Vinyl({
				cwd: firstFile.cwd,
				base: firstFile.base,
				path: path.join(firstFile.base, filename),
				contents: data
			}));

			callback();
		})();

		zip.end();
	});
};
