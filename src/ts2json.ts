import * as ts from 'typescript';

const PROPERTY_TYPES: any = {
    any: ts.SyntaxKind.AnyKeyword,
    boolean: ts.SyntaxKind.BooleanKeyword,
    number: ts.SyntaxKind.NumberKeyword,
    string: ts.SyntaxKind.StringKeyword,
};

class TSNode {
    private children: any[];
    private name: any;
    private type: any;

    constructor(name: any, type?: any) {
        this.children = [];
        this.name = name;
        this.type = type;
    }

    public addChildren(name: any, type: any): TSNode {
        let node = new TSNode(name, type);
        this.children.push(node);
        return node;
    }

    private getType() {
        return this.type;
    }

    public getObject() {
        let map: any = {};
        map[this.name] = this.children.length
            ? this.children
                .map(child => child.getObject())
                .reduce((pv, child) => {
                    for (let key in child) {
                        let first = pv.hasOwnProperty(key);
                        let second = key in pv;
                        if ((pv.hasOwnProperty(key) || (key in pv)) && pv[key]) {
                            (<any>Object).assign(pv[key], child[key]);
                        } else {
                            pv[key] = child[key];
                        }
                    }
                    return pv;
                }, {})
            : this.type;
        return map;
    }
}

let visit = function (parent: any) {
    return function (node: any) {
        switch (node.kind) {
            case ts.SyntaxKind.ModuleDeclaration: {
                let moduleName = node.name.text;
                ts.forEachChild(node, visit(parent.addChildren(moduleName)));
            }
                break;
            case ts.SyntaxKind.ModuleBlock: {
                ts.forEachChild(node, visit(parent));
            }
                break;
            case ts.SyntaxKind.InterfaceDeclaration: {
                let interfaceName = node.name.text;
                parent[interfaceName] = {};
                // console.log('interface');
                ts.forEachChild(node, visit(parent.addChildren(interfaceName)));
            }
                break;
            case ts.SyntaxKind.PropertySignature: {
                let propertyName = node.name;
                let propertyType = node.type;
                let arrayDeep = 0;
                let realPropertyName =
                    'string' !== typeof propertyName && 'text' in propertyName
                        ? propertyName.text
                        : propertyName;
                while (propertyType.kind === ts.SyntaxKind.ArrayType) {
                    arrayDeep++;
                    propertyType = propertyType.elementType;
                }
                if (propertyType.kind === ts.SyntaxKind.TypeReference) {
                    let realPropertyType = propertyType.typeName;
                    parent.addChildren(
                        realPropertyName,
                        'Array<'.repeat(arrayDeep) +
                        (realPropertyType.kind === ts.SyntaxKind.QualifiedName
                            ? realPropertyType.getText()
                            : 'text' in realPropertyType
                                ? realPropertyType.text
                                : realPropertyType) +
                        '>'.repeat(arrayDeep)
                    );
                } else {
                    for (let type in PROPERTY_TYPES) {
                        if (propertyType.kind === PROPERTY_TYPES[type]) {
                            parent.addChildren(realPropertyName, type);
                            break;
                        }
                    }
                }
            }
                break;
            default:
                break;
        }
    };
};

export default function(filename: any, options: any) {
    const ROOT_NAME = 'root';
    const node = new TSNode(ROOT_NAME);

    let program = ts.createProgram([filename], options);
    let checker = program.getTypeChecker();
    let sourceFile = program.getSourceFiles()[1];

    ts.forEachChild(sourceFile, visit(node));

    return node.getObject()[ROOT_NAME];
}
