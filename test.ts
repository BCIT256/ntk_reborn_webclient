import fs from 'fs';
fetch('http://localhost:2011/assets/palettes/palette_meta.json').then(r => r.json()).then(j => console.log(JSON.stringify(j).substring(0, 200)));
