import * as ts2cs from "./ts2cs";
import path from 'path';


namespace asfassasf2 {

}


function main() {
    // @ts-ignore
    let file_name = process.argv[2];
    let file_ext = path.extname(file_name);
    if (!file_name.endsWith(".d.ts")) {
        throw new Error(`File name should have *.d.ts extension instead of ${file_ext}`);
    }
    ts2cs.default(file_name, {});
}

main();
