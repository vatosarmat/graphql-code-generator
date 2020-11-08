import moment from 'moment';
import { extname } from 'path';
export const plugin = async (schema, documents, config, { outputFile }) => {
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
    const outputFileExtension = outputFile && extname(outputFile);
    let commentPrefix = '//';
    if ((outputFileExtension || '').toLowerCase() === '.graphql') {
        commentPrefix = '#';
    }
    return commentPrefix + ' ' + message + moment().format(format) + '\n';
};
//# sourceMappingURL=index.js.map