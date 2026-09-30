// Whether the app is on its way out, so the quit handler doesn't hold it back a second time.
let quitting = false;

export const isQuitting = () => quitting;

export const setQuitting = () => {
  quitting = true;
};
