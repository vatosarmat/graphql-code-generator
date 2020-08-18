import { join } from 'path';
import { visit } from 'graphql';
import parsePath from 'parse-filepath';
export function defineFilepathSubfolder(baseFilePath, folder) {
    const parsedPath = parsePath(baseFilePath);
    return join(parsedPath.dir, folder, parsedPath.base).replace(/\\/g, '/');
}
export function appendExtensionToFilePath(baseFilePath, extension) {
    const parsedPath = parsePath(baseFilePath);
    return join(parsedPath.dir, parsedPath.name + extension).replace(/\\/g, '/');
}
export function extractExternalFragmentsInUse(documentNode, fragmentNameToFile, result = {}, level = 0) {
    const ignoreList = new Set();
    // First, take all fragments definition from the current file, and mark them as ignored
    visit(documentNode, {
        enter: {
            FragmentDefinition: (node) => {
                ignoreList.add(node.name.value);
            },
        },
    });
    // Then, look for all used fragments in this document
    visit(documentNode, {
        enter: {
            FragmentSpread: (node) => {
                if (!ignoreList.has(node.name.value)) {
                    if (result[node.name.value] === undefined ||
                        (result[node.name.value] !== undefined && level < result[node.name.value])) {
                        result[node.name.value] = level;
                        if (fragmentNameToFile[node.name.value]) {
                            extractExternalFragmentsInUse(fragmentNameToFile[node.name.value].node, fragmentNameToFile, result, level + 1);
                        }
                    }
                }
            },
        },
    });
    return result;
}
//# sourceMappingURL=utils.js.map