import * as dts from "./ts2json";


function main() {
    // @ts-ignore
    let file_name = process.argv[0];
    let json = dts.default(file_name, {});
    console.log(`json is ${JSON.stringify(json)}`);
}

main();
