/**
 * llmbit CLI 진입점 (bin). 본체는 cli.ts.
 */

import { main } from "./cli";

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`llmbit: ${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  },
);
