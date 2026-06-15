/* Shared light/dark theme controller.
   Applies the saved (or system) theme before paint, and wires up the
   #themeToggle button present in each page header. Preference persists
   in localStorage across all pages. */
(function () {
    var KEY = 'site-theme';
    var root = document.documentElement;

    function getPreferred() {
        var saved = null;
        try { saved = localStorage.getItem(KEY); } catch (e) {}
        if (saved === 'dark' || saved === 'light') return saved;
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            return 'dark';
        }
        return 'light';
    }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
    }

    // Apply immediately (script is loaded in <head>) to avoid a flash.
    apply(getPreferred());

    function updateButton(btn, theme) {
        if (!btn) return;
        var dark = theme === 'dark';
        btn.textContent = dark ? '☀' : '☾'; // sun in dark mode, moon in light
        btn.setAttribute('aria-pressed', dark ? 'true' : 'false');
        btn.setAttribute('title', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }

    document.addEventListener('DOMContentLoaded', function () {
        var btn = document.getElementById('themeToggle');
        updateButton(btn, root.getAttribute('data-theme'));
        if (!btn) return;
        btn.addEventListener('click', function () {
            var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            apply(next);
            try { localStorage.setItem(KEY, next); } catch (e) {}
            updateButton(btn, next);
        });
    });
})();
