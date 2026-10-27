# Supabase browser client

`supabase-2.118.0.js` is the unmodified UMD bundle from the official npm package `@supabase/supabase-js@2.118.0`, `dist/umd/supabase.js`. MIT license: [SUPABASE_LICENSE](SUPABASE_LICENSE).

- Source: https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.118.0.tgz
- npm package integrity: `sha512-FxI8UXMVC2UG7IkeiI8fuQZqq2oI3JeSuN8MPIC2RLVaoEAxKS0nqE6kii9Ewpq8f9gNPM6git1Y8f0vN/QLFw==`
- Bundle SHA-256: `ee3be8de192b97cb1d73d1e95d6b82bb1f6b658c0f97c4ef757fc331996ed3d3`

Only the optional configured connection diagnostic loads this client, lazily after Save/Read. Normal workout operation does not load it or depend on Supabase/CDN availability. Keeping the pinned client as a static asset preserves GymBro's no-build workflow and avoids a runtime CDN dependency. Update deliberately from the official package and rerun diagnostic tests when changing versions.

The SDK contains significant whitespace inside minified multiline strings. Its exact file is exempted from Git whitespace/end-of-line rewriting in `.gitattributes`; application source and tests retain their normal whitespace checks.
