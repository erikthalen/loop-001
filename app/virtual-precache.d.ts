// The type of `import precache from 'virtual:precache'` (see precache-plugin.ts).
declare module 'virtual:precache' {
  const precache: import('./precache-plugin.ts').Precache
  export default precache
}
