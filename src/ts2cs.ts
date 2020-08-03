import * as ts from 'typescript';
import nunjucks from "nunjucks";
import fs from "fs";


class TSNode {
    private _children: any[];
    private name: any;
    private type: any;

    constructor(name: any, type?: any) {
        this.name = name;
        this.type = type;
        this._children = [];
    }

    public addChildren(name: any, type: any): TSNode {
        let node = new TSNode(name, type);
        this._children.push(node);
        return node;
    }

    get children() {
        return this._children;
    }

    private getType() {
        return this.type;
    }

    public getObject() {
        let map: any = {};
        if (this.children.length) {
            map[this.name] = this.children
                .map(child => child.getObject())
                .reduce((pv, child) => {
                    for (let key in child) {
                        if ((pv.hasOwnProperty(key) || (key in pv)) && pv[key]) {
                            console.log(`pv[key] is ${pv[key]}`);
                            console.log(`child[key] is ${child[key]}`);
                            try {
                                (<any>Object).assign(pv[key], child[key]);
                            } catch (e) {
                            }
                        } else {
                            pv[key] = child[key];
                        }
                    }
                    return pv;
                }, {});
        } else {
            map[this.name] = this.type;
        }
        return map;
    }
}

let complexObjectMap = new Map();

function visit(prefix: string) {
    return function(node: any) {
        switch (node.kind) {
            case ts.SyntaxKind.ModuleDeclaration: {
                let moduleName = node.name.text;
                ts.forEachChild(node, visit(moduleName + "."));
            }
                break;
            case ts.SyntaxKind.ModuleBlock: {
                ts.forEachChild(node, visit(prefix));
            }
                break;
            case ts.SyntaxKind.InterfaceDeclaration: {
                let interfaceName = node.name.text;
                complexObjectMap.set(prefix + interfaceName, node);
            }
                break;
            case ts.SyntaxKind.PropertySignature: {
                let propertyName = node.name;
                let propertyType = node.type;
                let arrayDeep = 0;
                let realPropertyName =
                    ('string' !== typeof propertyName && 'text' in propertyName)
                        ? propertyName.text
                        : propertyName;
                while (propertyType.kind === ts.SyntaxKind.ArrayType) {
                    arrayDeep++;
                    propertyType = propertyType.elementType;
                }
                // if (propertyType.kind === ts.SyntaxKind.TypeReference) {
                //     let realPropertyType = propertyType.typeName;
                //     parent.addChildren(
                //         realPropertyName,
                //         'Array<'.repeat(arrayDeep) +
                //         (realPropertyType.kind === ts.SyntaxKind.QualifiedName
                //             ? realPropertyType.getText()
                //             : 'text' in realPropertyType
                //                 ? realPropertyType.text
                //                 : realPropertyType) +
                //         '>'.repeat(arrayDeep)
                //     );
                // } else {
                //     parent.addChildren(realPropertyName, propertyType.kind);
                // }
            }
                break;
            default:
                break;
        }
    };
}

function appendTypedPropertyToJson(json: any, propertyNode: any) {
    let propertyName = propertyNode.name;
    if (propertyName === undefined) {
        return;
    }

    let propertyType = propertyNode.type;
    let arrayDeep = 0;
    let realPropertyName =
        ('string' !== typeof propertyName && 'text' in propertyName)
            ? propertyName.text
            : propertyName;
    let realPropertyType;
    while (propertyType.kind === ts.SyntaxKind.ArrayType) {
        arrayDeep++;
        propertyType = propertyType.elementType;
    }
    if (propertyType.kind === ts.SyntaxKind.TypeReference) {
        let realPropertyType = propertyType.typeName;
        realPropertyType = 'Array<'.repeat(arrayDeep) +
        (realPropertyType.kind === ts.SyntaxKind.QualifiedName
            ? realPropertyType.getText()
            : 'text' in realPropertyType
                ? realPropertyType.text
                : realPropertyType) +
        '>'.repeat(arrayDeep);
    } else {
        switch (propertyType.kind) {
            case ts.SyntaxKind.StringKeyword: {
                realPropertyType = "string";
            }
                break;
            case ts.SyntaxKind.NumberKeyword: {
                realPropertyType = "double";
            }
                break;
            case ts.SyntaxKind.BooleanKeyword: {
                realPropertyType = "bool";
            }
                break;
        }
        if (propertyNode.questionToken) {
            realPropertyType += "?";
        }
    }
    json[realPropertyName] = realPropertyType;
}

function generate(context: any, fullName: string, tsNode: any) {
    let objectName = tsNode.name.escapedText;
    let namespaceName = '';
    let complexName = fullName.split(".");
    if (complexName.length > 1) {
        namespaceName = complexName.slice(0, complexName.length-1).join('.');
    }
    if (context.hasOwnProperty(fullName)) {
        return;
    }
    if (tsNode.heritageClauses) {
        for (const hr of tsNode.heritageClauses) {
            console.log(`hr is ${hr}`);
        }
    }

    let typedPropertiesJson = {};
    ts.forEachChild(tsNode, (node: any) => appendTypedPropertyToJson(typedPropertiesJson, node));
    let genObj = nunjucks.render(`BrowserInteropObject.cs`, {
        browserInteropApi: namespaceName,
        objectName: objectName,
        properties: typedPropertiesJson
    });
    console.log(`genObj is ${genObj}`);
    // @ts-ignore
    fs.writeFile(`./gen_dir/${objectName}.cs`, genObj, function (err: any, data: any) {
        if (err) {
            return console.log(err);
        }
        console.log(data);
    });
    context[fullName] = true;
}

export default function(filename: string, options: any) {
    const ROOT_PREFIX = '';

    let fileName = filename.slice(filename.lastIndexOf('/')+1);
    let program = ts.createProgram([filename], options);
    let checker = program.getTypeChecker();
    let sourceFiles = program.getSourceFiles();
    var sourceFile;
    for (let file of sourceFiles) {
        let flName = file.fileName;
        let lastIndex = flName.lastIndexOf('/');
        let fl = flName.slice(lastIndex+1);
        if (fl === fileName) {
            sourceFile = file;
            break;
        }
    }

    nunjucks.configure('templates', { autoescape: true });

    let context = {};
    // @ts-ignore
    ts.forEachChild(sourceFile, visit(ROOT_PREFIX));
    generate(context, 'AesDerivedKeyParams', complexObjectMap.get('AesDerivedKeyParams'))
    Object.assign({}, complexObjectMap);
}
