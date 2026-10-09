// Email-link credentials never become a session merely by appearing in a URL.
// Password sign-in remains the independently verified account boundary.
(() => {
  const sensitive = ['access_token', 'refresh_token', 'provider_token', 'provider_refresh_token',
    'expires_at', 'expires_in', 'token_type', 'type', 'code', 'token', 'token_hash',
    'error', 'error_code', 'error_description'];
  const url = new URL(window.location.href);
  const fragment = new URLSearchParams(url.hash.slice(1));
  const returned = sensitive.some(name => url.searchParams.has(name) || fragment.has(name));
  if (!returned) return;
  const failed = ['error', 'error_code', 'error_description'].some(name => url.searchParams.has(name) || fragment.has(name));
  const hasAuthFragment = sensitive.some(name => fragment.has(name));
  sensitive.forEach(name => { url.searchParams.delete(name); fragment.delete(name); });
  if (hasAuthFragment) url.hash = fragment.size ? fragment.toString() : '';
  let cleanupFailed = false;
  try { window.history.replaceState(null, '', url.pathname + url.search + url.hash); }
  catch { cleanupFailed = true; }
  // Retain only presentation flags; never tokens, provider errors or link values.
  window.AuthReturn = Object.freeze({ failed, cleanupFailed });
})();
