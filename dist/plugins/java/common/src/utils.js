import { Kind } from 'graphql';
export function buildPackageNameFromPath(path) {
    const unixify = require('unixify');
    return unixify(path || '')
        .replace(/src\/main\/.*?\//, '')
        .replace(/\//g, '.');
}
export function wrapTypeWithModifiers(baseType, typeNode, listType = 'Iterable') {
    if (typeNode.kind === Kind.NON_NULL_TYPE) {
        return wrapTypeWithModifiers(baseType, typeNode.type, listType);
    }
    else if (typeNode.kind === Kind.LIST_TYPE) {
        const innerType = wrapTypeWithModifiers(baseType, typeNode.type, listType);
        return `${listType}<${innerType}>`;
    }
    else {
        return baseType;
    }
}
//# sourceMappingURL=utils.js.map