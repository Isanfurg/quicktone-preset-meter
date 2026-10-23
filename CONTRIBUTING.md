# Contributing

Bug reports and small, focused pull requests are welcome. Spanish and English are both fine.

1. Describe the expected and actual behavior, browser/OS, modeler or interface, input channel, and reproduction steps.
2. Do not attach `session.json`, private device identifiers, licensed presets/IRs, tokens or other personal data to public issues.
3. Run `npm test` and, with Node.js 22.12+, `npm ci` then `npm run test:desktop`. For capture changes, test with a real interface and confirm that monitoring stays silent, cancellation does not save a partial take, and disconnects are handled.
4. Keep DSP formulas in `meter.mjs` and binary edits/balance in `patch-editor.mjs` independently testable. Preserve private payload bytes and require measurement fingerprints for automatic balance. Electron/Packager are the desktop build dependencies; avoid unnecessary packages.
5. Update the README when behavior or setup changes. Contributions are provided under the repository's MIT license.

Useful manual checks: permission refusal, unavailable/occupied input, mono versus stereo, missing right channel, clipping, guitar profile changes, reference replacement, page reload/persistence, export and background-tab audio suspension.
