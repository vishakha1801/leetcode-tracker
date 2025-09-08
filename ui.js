(function () {
    try {
      document.title = ''; // clean tab title
      Array.from(document.querySelectorAll("link[rel*='icon']")).forEach((n) => n.remove()); // nuke favicon
  
      if (!document.getElementById('vp-footer')) {
        const f = document.createElement('footer');
        f.id = 'vp-footer';
        f.style.cssText =
          'position:fixed;left:0;right:0;bottom:0;padding:8px 12px;font:12px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif;color:#666;background:#f7f7f7;border-top:1px solid #e5e5e5;text-align:center;z-index:2147483647';
        f.innerHTML =
          'made with &lt;3 in pittsburgh · privacy: this extension processes your LeetCode data locally and stores it in your browser. nothing is sent off your device.';
        document.body.appendChild(f);
        document.body.style.paddingBottom = (parseInt(getComputedStyle(f).height, 10) + 8) + 'px'; // be nice
      }
    } catch (_) {}
  })();
  