const puppeteer = require('puppeteer');
const fs = require('fs-extra');
const path = require('path');
const plot = require('svg-timeseries');

async function goNetflix() {
  const browser = await puppeteer.launch();
  const [page] = await browser.pages();
  await page.goto('https://fast.com');
  await page.waitForSelector('#show-more-details-link', { visible: true });
  const speed = await page.$eval('#speed-value', div => div.textContent);
  await browser.close();
  return speed;
}

async function goOokla() {
  const browser = await puppeteer.launch();
  const [page] = await browser.pages();
  await page.goto('https://www.speedtest.net');
  await page.waitForSelector('button#_evidon-banner-acceptbutton');
  await page.click('button#_evidon-banner-acceptbutton');
  await page.waitForSelector('a.js-start-test', { visible: true });
  await page.click('a.js-start-test');
  await page.waitForSelector('span.download-speed:not([data-download-status-value="NaN"])');
  const speed = await page.$eval('span.download-speed', span => span.textContent);
  await browser.close();
  return speed;
}

module.exports = async function () {
  const netflixCsvFilePath = path.join(__dirname, 'netflix.csv');
  let netflix;
  if (process.argv[2] === 'dry-run') {
    netflix = 'dry-run';
  }
  else {
    try {
      netflix = await goNetflix();
      console.log('Netflix', netflix);
      await fs.appendFile(netflixCsvFilePath, `${new Date().toISOString()},${netflix}\n`);
    }
    catch (error) {
      netflix = 'failed';
      console.log('Netflix error', error);
      // Ignore the individual service failure, we'll deal if all services fail
    }
  }

  const ooklaCsvFilePath = path.join(__dirname, 'ookla.csv');
  let ookla;
  if (process.argv[2] === 'dry-run') {
    ookla = 'dry-run';
  }
  else {
    try {
      ookla = await goOokla();
      console.log('Ookla', ookla);
      await fs.appendFile(ooklaCsvFilePath, `${new Date().toISOString()},${ookla}\n`);
    }
    catch (error) {
      ookla = 'failed';
      console.log('Ookla error', error);
      // Ignore the individual service failure, we'll deal if all services fail
    }
  }

  async function parsePoints(path) {
    const text = await fs.readFile(path, { encoding: 'ascii' });
    const lines = text.split('\n').slice(0, -1); // Ditch newline at the end
    const cells = lines.map(l => l.split(','));
    return cells.map(c => ({ x: new Date(c[0]).valueOf(), y: Number(c[1]) }));
  }

  function makePlot(netflixPoints, ooklaPoints, limit) {
    let title;
    switch (limit) {
      case '24-hours': {
        title = 'Last 24 hours';
        limit = new Date();
        limit.setHours(limit.getHours() - 24);
        break;
      }
      case '7-days': {
        title = 'Last 7 days';
        limit = new Date();
        limit.setDate(limit.getDate() - 7);
        break;
      }
      case '30-days': {
        title = 'Last 30 days';
        limit = new Date();
        limit.setDate(limit.getDate() - 30);
        break;
      }
      case undefined: {
        title = 'All time';
        break;
      }
      default: {
        throw new Error(`Unexpected limit value: ${limit}.`)
      }
    }

    if (limit) {
      netflixPoints = { ...netflixPoints, points: netflixPoints.points.filter(p => p.x >= limit) };
      ooklaPoints = { ...ooklaPoints, points: ooklaPoints.points.filter(p => p.x >= limit) };
    }

    if (netflixPoints.points.length < 2 || ooklaPoints.points.length < 2) {
      return [];
    }

    const svg = plot(640, 480, 10, 'gray', netflixPoints, ooklaPoints);
    return [
      `<b>${title}</b>`,
      // Embed SVG in `img` with a Base64 data URI because SVG in EML doesn't work
      '<img width="100%" src="data:image/svg+xml;base64,',
      // Split the Base64 lines into 76 characters each for MIME
      ...Buffer.from(svg).toString('base64').match(/.{0,76}/g),
      '" />'
    ];
  }

  const netflixPoints = { color: 'maroon', points: await parsePoints(netflixCsvFilePath) };
  const ooklaPoints = { color: 'blue', points: await parsePoints(ooklaCsvFilePath) };

  return [
    '<ul>',
    `<li>Netflix: ${netflix}</li>`,
    `<li>Ookla: ${ookla}</li>`,
    '</ul>',

    ...makePlot(netflixPoints, ooklaPoints, '24-hours'),
    ...makePlot(netflixPoints, ooklaPoints, '7-days'),
    ...makePlot(netflixPoints, ooklaPoints, '30-days'),
    ...makePlot(netflixPoints, ooklaPoints)
  ];
};

if (process.cwd() === __dirname) {
  module.exports().then(console.log);
}
