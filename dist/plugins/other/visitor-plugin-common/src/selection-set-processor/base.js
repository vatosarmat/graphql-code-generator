export class BaseSelectionSetProcessor {
    constructor(config) {
        this.config = config;
    }
    buildFieldsIntoObject(allObjectsMerged) {
        return `{ ${allObjectsMerged.join(', ')} }`;
    }
    buildSelectionSetFromStrings(pieces) {
        if (pieces.length === 0) {
            return null;
        }
        else if (pieces.length === 1) {
            return pieces[0];
        }
        else {
            return `(\n  ${pieces.join(`\n  & `)}\n)`;
        }
    }
    transformPrimitiveFields(schemaType, fields) {
        throw new Error(`Please override "transformPrimitiveFields" as part of your BaseSelectionSetProcessor implementation!`);
    }
    transformAliasesPrimitiveFields(schemaType, fields) {
        throw new Error(`Please override "transformAliasesPrimitiveFields" as part of your BaseSelectionSetProcessor implementation!`);
    }
    transformLinkFields(fields) {
        throw new Error(`Please override "transformLinkFields" as part of your BaseSelectionSetProcessor implementation!`);
    }
    transformTypenameField(type, name) {
        throw new Error(`Please override "transformTypenameField" as part of your BaseSelectionSetProcessor implementation!`);
    }
}
//# sourceMappingURL=base.js.map