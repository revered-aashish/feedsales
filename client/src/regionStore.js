// Module-level store so the Axios interceptor (outside React) can read the active region.
let _region = null;

export const regionStore = {
  get: () => _region,
  set: (r) => { _region = r; },
};
