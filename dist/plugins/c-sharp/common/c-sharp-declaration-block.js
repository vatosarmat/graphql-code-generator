import { indentMultiline } from '@graphql-codegen/visitor-plugin-common';
import { transformComment } from './utils';
export class CSharpDeclarationBlock {
    constructor() {
        this._name = null;
        this._extendStr = [];
        this._implementsStr = [];
        this._kind = null;
        this._access = 'public';
        this._final = false;
        this._static = false;
        this._block = null;
        this._comment = null;
        this._nestedClasses = [];
    }
    nestedClass(nstCls) {
        this._nestedClasses.push(nstCls);
        return this;
    }
    access(access) {
        this._access = access;
        return this;
    }
    asKind(kind) {
        this._kind = kind;
        return this;
    }
    final() {
        this._final = true;
        return this;
    }
    static() {
        this._static = true;
        return this;
    }
    withComment(comment) {
        if (comment) {
            this._comment = transformComment(comment, 1);
        }
        return this;
    }
    withBlock(block) {
        this._block = block;
        return this;
    }
    extends(extendStr) {
        this._extendStr = extendStr;
        return this;
    }
    implements(implementsStr) {
        this._implementsStr = implementsStr;
        return this;
    }
    withName(name) {
        this._name = typeof name === 'object' ? name.value : name;
        return this;
    }
    get string() {
        let result = '';
        if (this._kind) {
            let name = '';
            if (this._name) {
                name = this._name;
            }
            if (this._kind === 'namespace') {
                result += `${this._kind} ${name} `;
            }
            else {
                let extendStr = '';
                let implementsStr = '';
                const final = this._final ? ' final' : '';
                const isStatic = this._static ? ' static' : '';
                if (this._extendStr.length > 0) {
                    extendStr = ` : ${this._extendStr.join(', ')}`;
                }
                if (this._implementsStr.length > 0) {
                    implementsStr = ` : ${this._implementsStr.join(', ')}`;
                }
                result += `${this._access}${isStatic}${final} ${this._kind} ${name}${extendStr}${implementsStr} `;
            }
        }
        const nestedClasses = this._nestedClasses.length
            ? this._nestedClasses.map(c => indentMultiline(c.string)).join('\n\n')
            : null;
        const before = '{';
        const after = '}';
        const block = [before, nestedClasses, this._block, after].filter(f => f).join('\n');
        result += block;
        return (this._comment ? this._comment : '') + result + '\n';
    }
}
//# sourceMappingURL=c-sharp-declaration-block.js.map