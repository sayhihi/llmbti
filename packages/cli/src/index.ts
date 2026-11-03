/**
 * llmbit CLI 진입점 (bin). 본체는 cli.ts.
 */

import { main } from "./cli";

process.exitCode = main(process.argv.slice(2));
