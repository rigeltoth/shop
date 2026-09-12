import type { Plugin } from 'vite';

export function injectGtm(): Plugin {
  return {
    name: 'inject-gtm',
    transformIndexHtml(html: string) {
      const gtmId = process.env.VITE_GTM_ID;

      if (!gtmId) {
        return html;
      }

      const gtmScript = `<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({\'gtm.start\':
new Date().getTime(),event:\'gtm.js\'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!=\'dataLayer\'?\'&l=\':\'\';j.async=true;j.src=
\'https://www.googletagmanager.com/gtm.js?id=\'+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,\'script\',\'dataLayer\',\'${gtmId}\
');</script>`;

      const gtmNoscript = `<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->`;

      const headIndex = html.indexOf('</head>');
      const bodyIndex = html.indexOf('<body>');

      if (headIndex !== -1) {
        html = html.substring(0, headIndex) + gtmScript + html.substring(headIndex);
      }
      if (bodyIndex !== -1) {
        html = html.substring(0, bodyIndex + '<body>'.length) + gtmNoscript + html.substring(bodyIndex + '<body>'.length);
      }

      return html;
    },
  };
}
