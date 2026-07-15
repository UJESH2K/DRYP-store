import http from 'http';

http.get('http://localhost:3000/signup', (res) => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    const hasGoogle = d.toLowerCase().includes('google');
    console.log('Has Google text:', hasGoogle);

    const hrefRegex = /href="([^"]*google[^"]*)"/gi;
    let m;
    let count = 0;
    while ((m = hrefRegex.exec(d)) !== null) {
      count++;
      console.log('  href:', m[1].substring(0, 300));
    }
    console.log('Google hrefs found:', count);

    const apiRegex = /\/api\/auth\/google/g;
    const apiMatches = d.match(apiRegex);
    console.log('/api/auth/google references:', apiMatches ? apiMatches.length : 0);

    const uriRegex = /redirect_uri[^&"]+/gi;
    let uriMatch;
    while ((uriMatch = uriRegex.exec(d)) !== null) {
      console.log('  redirect_uri param:', decodeURIComponent(uriMatch[0]));
    }

    process.exit(0);
  });
}).on('error', e => { console.log('Error:', e.message); process.exit(1); });
