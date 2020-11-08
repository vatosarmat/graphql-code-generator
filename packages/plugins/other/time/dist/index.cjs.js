'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

const moment = _interopDefault(require('moment'));
const path = require('path');

const plugin = async (schema, documents, config, { outputFile }) => {
    let format;
    let message = 'Generated on ';
    if (config && typeof config === 'object') {
        if (config.format) {
            format = config.format;
        }
        if (config.message) {
            message = config.message;
        }
    }
    const outputFileExtension = outputFile && path.extname(outputFile);
    let commentPrefix = '//';
    if ((outputFileExtension || '').toLowerCase() === '.graphql') {
        commentPrefix = '#';
    }
    return commentPrefix + ' ' + message + moment().format(format) + '\n';
};

exports.plugin = plugin;
//# sourceMappingURL=index.cjs.js.map
