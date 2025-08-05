# heylock

## Usage

```js
import Heylock from 'heylock';
const heylock = new Heylock('your-api-key');
const reply = await heylock.message('Hello!');
```

## TypeScript
Type declarations are available via `types.d.ts` and referenced in `package.json`.

## Build
To generate a minified bundle:

```
npm install --save-dev rollup rollup-plugin-terser
npx rollup -c
```

## Test
To run basic tests:

```
node test/basic.test.js
```

## TODO (done)
- [x] Write comments & function descriptions (JSDOC)
- [x] Develop TS compatibility
- [x] Compress on publishing
- [x] Test & Prepare for publishing