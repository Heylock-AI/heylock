# Heylock

AI-powered messaging, rewriting, sorting, and context management client for JavaScript/TypeScript.

Works in Node.js and modern browsers.

## Installation

```bash
npm install heylock
```

## Quick start

```ts
import Heylock from 'heylock';

const heylock = new Heylock(process.env.HEYLOCK_API_KEY!);

const reply = await heylock.message('Hello!');
console.log(reply);
```

## API Key

Get your API key from your Heylock dashboard. Pass it to the constructor. The client validates the key on first use.

## Core features

- Messages: chat-style requests with optional history and streaming
- Rewrites: transform text with optional instructions
- Sorts: sort arrays based on natural-language instructions and return indexes + reasoning
- Context: track user actions and attach context to AI requests
- Quotas: handle 429 responses with limit, remaining, and reset metadata

## Usage

### Send a message

```ts
const heylock = new Heylock('your-api-key');

const res = await heylock.message('Summarize the following...');
console.log(res);
```

With history:

```ts
const history = [
	{ role: 'user', content: 'Hi there!' },
	{ role: 'assistant', content: 'Hello! How can I help you?' }
];

const res = await heylock.message('What did I say earlier?', history);
```

Streaming:

```ts
let full = '';
for await (const chunk of heylock.messageStream('Tell me a story')) {
	process.stdout.write(chunk);
	full += chunk;
}
```

### Rewrite text

```ts
const output = await heylock.rewrite('Hi!', 'Rewrite politely');
```

### Sort arrays

```ts
const items = ['apple', 'banana', 'orange'];
const result = await heylock.sort(items, 'Sort by sweetness');
console.log(result.indexes, result.reasoning);
```

### Context helpers

```ts
heylock.addContext('User opened pricing page');
heylock.addContext('User clicked Buy');

console.log(heylock.getContext());
console.log(heylock.getContextAsString());

heylock.clearContext();
```

## Quotas and 429 handling

When you exceed plan limits, the API responds with 429. The client throws a typed error (name = `HeylockQuotaError`) that includes helpful metadata.

```ts
try {
	const res = await heylock.message('Lots of usage...');
} catch (err) {
	if (err && err.name === 'HeylockQuotaError') {
		console.log('Quota exceeded');
		console.log('Plan:', err.plan);
		console.log('Limit:', err.limit);
		console.log('Remaining:', err.remaining);
		console.log('Resets at:', err.resetAt);
		return;
	}
	throw err; // rethrow other errors
}
```

You can also query the limits endpoint:

```ts
const info = await heylock.getLimits();
console.log(info.plan, info.plan_expires);
console.log(info.limits.messages);
console.log(info.headers.limit, info.headers.remaining, info.headers.resetAt);
```

Headers exposed:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (epoch seconds)
- `X-Plan`
- `X-Plan-Expires` (epoch seconds)

## Error handling

Common errors thrown by the client:

- 400 Bad request: validation error message from API
- 401 Unauthorized: invalid/expired key
- 429 Quota exceeded: use the fields on the error object
- 500 Server error: retry later
- Network errors: provide user-friendly guidance

## TypeScript

The package ships with complete typings, including the quota error type and the limits response.

```ts
import Heylock, { HeylockQuotaError, HeylockLimitsResponse } from 'heylock';
```

## Node.js and browser

The client works in Node.js and browsers. In Node, cookie-based context storage is a no-op.

## Versioning

SemVer. Breaking changes will bump the major version.

## License

ISC


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