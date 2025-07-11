console.log('Testing API...'); fetch('http://localhost:3003/api/news/articles?limit=1').then(r => r.json()).then(console.log).catch(console.error);
