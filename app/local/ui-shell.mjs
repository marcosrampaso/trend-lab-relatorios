// Decorate served HTML, including generated and archived reports, without rewriting their evidence.
export function injectLabShell(html){if(html.includes('data-trend-shell'))return html;const assets='<link rel="stylesheet" href="/ui/shell.css" data-trend-shell><script type="module" src="/ui/shell.js"></script>';if(/<\/head\s*>/i.test(html))return html.replace(/<\/head\s*>/i,assets+'</head>');if(/<header\b|<body\b|<main\b/i.test(html))return html.replace(/(?=<header\b|<body\b|<main\b)/i,assets);return assets+html;}

export function localPagePath(url){return ['/','/index.html'].includes(url.pathname)?(url.searchParams.has('view')?'/index.html':'/inicio.html'):url.pathname;}
