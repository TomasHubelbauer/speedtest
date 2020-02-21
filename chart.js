module.exports = function chart(...series) {
  const width = 640;
  const height = 480;
  const trim = 10;
  const color = 'gray';
  let svg = [`<svg version="1.1" width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`];

  // Render the X axis
  svg.push(`<line x1="${trim / 2}" y1="${height - trim}" x2="${width - trim / 2}" y2="${height - trim}" stroke="${color}" />`);

  // Render the Y axis
  svg.push(`<line x1="${trim}" y1="${height - trim / 2}" x2="${trim}" y2="${trim / 2}" stroke="${color}" />`);

  // Find the extemes of the X axis to map the individal values between
  const minimumX = Math.min(...series.map(s => s.points.reduce((a, c) => Math.min(a, c.x), s.points[0].x)));
  const maximumX = Math.max(...series.map(s => s.points.reduce((a, c) => Math.max(a, c.x), s.points[0].x)));

  // Find the top extreme of the Y axis to ensure the chart always starts at a zeo
  const minimumY = Math.min(...series.map(s => s.points.reduce((a, c) => Math.min(a, c.y), 0)));
  const maximumY = Math.max(...series.map(s => s.points.reduce((a, c) => Math.max(a, c.y), 0)));

  // Render the individual series'
  for (const serie of series) {
    let polylineSvg = '<polyline points="';
    for (const point of serie.points) {
      // Map the x and y values to the area of the chart
      const x = trim + ((point.x - minimumX) / (maximumX - minimumX)) /* 0-1 */ * (width - trim * 2);
      const y = trim + (1 - ((point.y - minimumY) / (maximumY - minimumY))) /* 1-0 */ * (height - trim * 2);
      polylineSvg += x + ',' + y + ' ';

      // Render the X axis marker
      svg.push(`<line x1="${x}" y1="${height - trim / 2}" x2="${x}" y2="${height - trim - trim / 2}" stroke="${serie.color}" />`);
      svg.push(`<text x="${x}" y="${height - trim - 110}" style="writing-mode: tb;">${new Date(point.x).toISOString().slice(0, 13)}</text>`);

      // Render the Y axis marker
      svg.push(`<line x1="${trim / 2}" y1="${y}" x2="${trim + trim / 2}" y2="${y}" stroke="${serie.color}" />`);
      svg.push(`<text x="${x - 10}" y="${y + 15}">${point.y}</text>`);
    }

    polylineSvg += `" stroke="${serie.color}" fill="none" />`;
    svg.push(polylineSvg);
  }

  svg.push('</svg>');
  return svg;
}
