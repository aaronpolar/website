/* ============================================================
   Site-wide scroll reveal + small interactions. Paired with
   animations.css. Adds `.js-anim` to <html> immediately so the
   CSS reveal rules only apply when JS is present (no stuck-hidden
   content if this file fails to load).
   ============================================================ */
(function () {
    var root = document.documentElement;
    root.classList.add('js-anim');

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Blocks that should fade/slide in as they scroll into view. Pages that
    // already tag elements with .reveal (e.g. fishing) still work — adding the
    // class again is harmless and a single observer handles them all.
    var AUTO = [
        '.header-text p',
        '.lin-section',
        '.lin-card',
        '.stat-card',
        '.project',
        '.projects-hero',
        '.projects-outro',
        '.certs-hero',
        '.cert-step',
        '.dash-hero',
        '.review-card',
        '.notfound'
    ];

    function run() {
        // Tag auto-reveal targets.
        AUTO.forEach(function (sel) {
            document.querySelectorAll(sel).forEach(function (el) {
                el.classList.add('reveal');
            });
        });

        // Stagger siblings that share a parent for a cascading effect.
        var groups = {};
        var all = document.querySelectorAll('.reveal');
        all.forEach(function (el) {
            var p = el.parentNode;
            if (!p._revealIndex) p._revealIndex = 0;
            var i = p._revealIndex++;
            if (i > 0 && !el.style.transitionDelay) {
                el.style.transitionDelay = Math.min(i * 0.08, 0.4) + 's';
            }
        });

        // Capture progress-bar targets, then let CSS hold them at 0 until reveal.
        function fillBars(scope) {
            (scope || document).querySelectorAll('[data-width]').forEach(function (bar) {
                bar.style.width = bar.getAttribute('data-width');
            });
        }

        if (reduceMotion || !('IntersectionObserver' in window)) {
            all.forEach(function (el) { el.classList.add('is-visible'); });
            fillBars(document);
            return;
        }

        var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                fillBars(entry.target);
                io.unobserve(entry.target);
            });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

        all.forEach(function (el) { io.observe(el); });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

    /* Count a number up from 0 to its target. Exposed for page scripts
       (e.g. the Life in Numbers dashboard) to call after data loads. */
    window.animateCount = function (el, target) {
        if (el == null) return;
        if (reduceMotion || typeof target !== 'number' || !isFinite(target)) {
            el.textContent = (typeof target === 'number') ? target.toLocaleString() : target;
            return;
        }
        var duration = 900;
        var start = null;
        function tick(ts) {
            if (start === null) start = ts;
            var p = Math.min((ts - start) / duration, 1);
            var eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
            el.textContent = Math.round(target * eased).toLocaleString();
            if (p < 1) requestAnimationFrame(tick);
            else el.textContent = target.toLocaleString();
        }
        requestAnimationFrame(tick);
    };
})();
