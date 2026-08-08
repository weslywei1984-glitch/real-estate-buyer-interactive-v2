# Task 1 report: Contact normalization, payload, and Apps Script contract

## RED

- Command: `node --test tests/payload.test.js tests/apps-script.test.js`
- Result: failed as expected. `src/contact.js` did not exist; Apps Script still used the `手機號碼` header and phone-only `invalid phone` validation, so the new 31-cell LINE ID contract tests failed for the intended missing behavior.
- Command: `npx.cmd playwright test tests/app.spec.js --grep "手機號碼 or LINE ID|contact validation" --project=desktop --project=mobile`
- Result: failed as expected. Desktop and mobile could not find the new `手機號碼 or LINE ID` input; the LINE-ID submission test timed out waiting for that required field.

## GREEN

- Command: `node --test tests/payload.test.js tests/apps-script.test.js`
- Result: 12 passed, 0 failed.
- Command: `npx.cmd playwright test tests/app.spec.js --grep "手機號碼 or LINE ID|contact validation" --project=desktop --project=mobile`
- Result: 4 passed, 0 failed.
- Regression checks: `npm.cmd test` (45 passed), `npx.cmd playwright test tests/app.spec.js --project=desktop --project=mobile` (80 passed), `git diff --check`, and Node syntax checks for the changed front-end modules all passed.

## Changed files

- `src/contact.js`
- `src/payload.js`
- `src/app.js`
- `apps-script/Code.gs`
- `tests/payload.test.js`
- `tests/apps-script.test.js`
- `tests/app.spec.js`

## Commit

- `3824ce70b58acc7ebeb4fd9d06fd2a6c63e84585` — `feat: accept phone or LINE contact`

## Concerns

- No formal Apps Script deployment or production Sheet write was performed, per Task 1 scope.
- Result-page layout, corrected LINE URL, phone action, and demand-image work remain intentionally deferred to Tasks 2 and 3.
