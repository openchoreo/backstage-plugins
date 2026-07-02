// Font assets are imported for their resolved URL (a string). backstage-cli's
// build copies them to dist via forwardFileImports; these declarations let
// `tsc` type-check the imports.
declare module '*.woff2' {
  const src: string;
  export default src;
}
declare module '*.woff' {
  const src: string;
  export default src;
}
declare module '*.ttf' {
  const src: string;
  export default src;
}
declare module '*.eot' {
  const src: string;
  export default src;
}
