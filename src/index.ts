import fs from 'fs/promises';
import path from 'path';
import prettier from 'prettier';
import groupBy from 'lodash-es/groupBy.js';

type Data = NonNullable<ReturnType<typeof parser>>;

const srcDir = `monaspace/fonts/webfonts`;
const outdir = 'fonts';
const fontsDir = path.join(outdir, 'files');

await fs.rm(outdir, { recursive: true });
await fs.mkdir(outdir, { recursive: true });
await fs.mkdir(fontsDir, { recursive: true });

const weights = {
  Bold: 700,
  ExtraBold: 800,
  ExtraLight: 200,
  Light: 300,
  Medium: 500,
  Regular: 400,
  SemiBold: 600,
};

const variantRegex = new RegExp(
  `^(Wide|SemiWide)?(${Object.keys(weights).join('|')})?(Italic)?$`
);

const fonts = await fs.readdir(srcDir);
const parser = (filename: string) => {
  const matches = filename.match(/Monaspace(.*)-(.*)\.(.*)/);
  if (!matches?.length) {
    console.log(`Skiped ${filename}`);
    return;
  }
  const [, font, variant, format] = matches;
  const [, wide, weight, style] = variant.match(variantRegex) || [];
  const d = {
    filename,
    filepath: path.join(srcDir, filename),
    font,
    format,
    wide:
      wide?.replace(
        /[A-Z]/g,
        (c, i: number) => (i === 0 ? '' : '-') + c.toLowerCase()
      ) || 'normal',
    weight: weights[weight || 'Regular'],
    style: style?.toLowerCase() || 'normal',
  };

  const url = `./${path.relative(outdir, fontsDir)}/${d.filename}`;

  return {
    ...d,
    css: `
      @font-face {
        font-family: 'Monaspace ${d.font}';
        font-style: '${d.style}';
        font-display: swap;
        font-weight: ${d.weight};
        src: url(${url}) format('woff');
      }
    `.trim(),
  };
};

const data = fonts.map(parser).filter((d): d is Data => !!d);
const cssFiles: string[] = [];

await fs.writeFile(path.join('data.json'), JSON.stringify(data, null, 2));

const writeCss = async (filepath: string, group: Data[]) => {
  const dist = path.join(
    outdir,
    filepath.endsWith('.css') ? filepath : `${filepath}.css`
  );
  await fs.mkdir(path.dirname(dist), { recursive: true });

  await fs.writeFile(
    dist,
    await prettier.format(
      group
        .sort((a, b) => a.weight - b.weight)
        .map((d) => d.css)
        .join('\n\r'),
      {
        parser: 'css',
      }
    )
  );

  cssFiles.push(path.basename(filepath));
};

const groupByFont = Object.entries(groupBy(data, (d) => d.font));

for (const [font, fontGroup] of groupByFont) {
  const groupByWide = Object.entries(groupBy(fontGroup, (d) => d.wide));

  for (const [wide, wideGroup] of groupByWide) {
    const groupByStyle = Object.entries(groupBy(wideGroup, (d) => d.style));

    for (const [style, styleGroup] of groupByStyle) {
      await writeCss(
        [font.toLowerCase(), wide, style]
          .filter((s) => s !== 'normal')
          .join('-') + '.css',
        styleGroup
      );
    }
  }
}

for (const font of fonts) {
  await fs.copyFile(path.join(srcDir, font), path.join(fontsDir, font));
}

await fs.writeFile(
  path.join(outdir, 'index.d.ts'),
  cssFiles.map((file) => `declare module 'monaspace-font/${file}';`).join('\n')
);
