import next from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...next,
  ...nextTs,
  {
    rules: {
      // Sign-in, sign-out and workspace creation need a full navigation so the request proxy and server components
      // see the new session cookies; router.push would reuse the client cache.
      "@next/next/no-location-assign-relative-destination": "off",
      // TanStack Virtual returns functions the React Compiler cannot memoize; the list component is simply not compiled.
      "react-hooks/incompatible-library": "off",
    },
  },
  { ignores: [".next/**", "node_modules/**", "src/lib/api/schema.d.ts", "next-env.d.ts", "public/sw.js"] },
];

export default config;
