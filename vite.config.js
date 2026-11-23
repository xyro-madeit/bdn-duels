import { defineConfig } from 'vite';

// Expose the public Supabase settings to the browser build under either naming scheme:
// VITE_* (README) or NEXT_PUBLIC_* (added automatically by Vercel's Supabase integration).
// Only variables the code reads by name end up in the bundle; server secrets never do.
export default defineConfig({
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
});
