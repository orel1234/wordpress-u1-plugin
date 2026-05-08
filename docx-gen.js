'use strict';

// ── Minimal ZIP writer (store / no compression) ───────────────────────────────

class ZipWriter {
  constructor() {
    this._files = [];
    this._crcTable = this._buildCrcTable();
  }

  _buildCrcTable() {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[i] = c;
    }
    return t;
  }

  _crc32(data) {
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) {
      crc = this._crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  _enc(str) {
    return new TextEncoder().encode(str);
  }

  add(name, content) {
    const data = typeof content === 'string' ? this._enc(content) : content;
    this._files.push({ name, data });
  }

  toUint8Array() {
    const enc = (s) => this._enc(s);
    const localHeaders = [];
    let offset = 0;

    for (const f of this._files) {
      const nameB = enc(f.name);
      const crc = this._crc32(f.data);
      const header = new Uint8Array(30 + nameB.length);
      const v = new DataView(header.buffer);
      v.setUint32(0,  0x04034b50, true);
      v.setUint16(4,  20, true);
      v.setUint16(6,  0,  true);
      v.setUint16(8,  0,  true); // store
      v.setUint16(10, 0,  true);
      v.setUint16(12, 0,  true);
      v.setUint32(14, crc,            true);
      v.setUint32(18, f.data.length,  true);
      v.setUint32(22, f.data.length,  true);
      v.setUint16(26, nameB.length,   true);
      v.setUint16(28, 0,              true);
      header.set(nameB, 30);
      localHeaders.push({ header, data: f.data, nameB, crc, offset });
      offset += header.length + f.data.length;
    }

    const centralDirs = [];
    for (const lh of localHeaders) {
      const cd = new Uint8Array(46 + lh.nameB.length);
      const v = new DataView(cd.buffer);
      v.setUint32(0,  0x02014b50,      true);
      v.setUint16(4,  20,              true);
      v.setUint16(6,  20,              true);
      v.setUint16(8,  0,               true);
      v.setUint16(10, 0,               true);
      v.setUint16(12, 0,               true);
      v.setUint16(14, 0,               true);
      v.setUint32(16, lh.crc,          true);
      v.setUint32(20, lh.data.length,  true);
      v.setUint32(24, lh.data.length,  true);
      v.setUint16(28, lh.nameB.length, true);
      v.setUint16(30, 0, true);
      v.setUint16(32, 0, true);
      v.setUint16(34, 0, true);
      v.setUint16(36, 0, true);
      v.setUint32(38, 0, true);
      v.setUint32(42, lh.offset,       true);
      cd.set(lh.nameB, 46);
      centralDirs.push(cd);
    }

    const cdOffset = offset;
    const cdSize   = centralDirs.reduce((s, c) => s + c.length, 0);
    const eocd     = new Uint8Array(22);
    const ev       = new DataView(eocd.buffer);
    ev.setUint32(0,  0x06054b50,          true);
    ev.setUint16(4,  0,                   true);
    ev.setUint16(6,  0,                   true);
    ev.setUint16(8,  this._files.length,  true);
    ev.setUint16(10, this._files.length,  true);
    ev.setUint32(12, cdSize,              true);
    ev.setUint32(16, cdOffset,            true);
    ev.setUint16(20, 0,                   true);

    const total  = offset + cdSize + 22;
    const result = new Uint8Array(total);
    let pos = 0;
    for (const lh of localHeaders) {
      result.set(lh.header, pos); pos += lh.header.length;
      result.set(lh.data,   pos); pos += lh.data.length;
    }
    for (const cd of centralDirs) { result.set(cd, pos); pos += cd.length; }
    result.set(eocd, pos);
    return result;
  }
}

// ── OOXML helpers ─────────────────────────────────────────────────────────────

function xe(str) {
  if (!str) return '';
  return str
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

function wText(s) {
  const escaped = xe(s);
  const needsPreserve = s.startsWith(' ') || s.endsWith(' ') || s.includes('  ');
  return needsPreserve
    ? `<w:t xml:space="preserve">${escaped}</w:t>`
    : `<w:t>${escaped}</w:t>`;
}

function para(text, styleId, rPrExtra = '') {
  if (!text) return `<w:p><w:pPr><w:pStyle w:val="${styleId || 'Normal'}"/></w:pPr></w:p>`;
  return `<w:p>
  <w:pPr><w:pStyle w:val="${styleId || 'Normal'}"/></w:pPr>
  <w:r>${rPrExtra}${wText(text)}</w:r>
</w:p>`;
}

function heading(text, level) {
  return `<w:p>
  <w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr>
  <w:r><w:t>${xe(text)}</w:t></w:r>
</w:p>`;
}

function bullet(text) {
  return `<w:p>
  <w:pPr>
    <w:pStyle w:val="ListParagraph"/>
    <w:ind w:left="720" w:hanging="360"/>
  </w:pPr>
  <w:r><w:t xml:space="preserve">•  ${xe(text)}</w:t></w:r>
</w:p>`;
}

function codeLines(lines) {
  return lines.map(line =>
    `<w:p>
  <w:pPr>
    <w:pStyle w:val="CodeBlock"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>
      <w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr>
    ${wText(line || ' ')}
  </w:r>
</w:p>`
  ).join('\n');
}

function codeBlock(code) {
  return codeLines(code.split('\n'));
}

function emptyPara() {
  return '<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr></w:p>';
}

// ── DOCX styles.xml ───────────────────────────────────────────────────────────

function buildStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
          xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
        <w:sz w:val="24"/><w:szCs w:val="24"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>

  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:pPr><w:spacing w:after="160"/></w:pPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Title">
    <w:name w:val="Title"/>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="0" w:after="240"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="1F3864"/>
      <w:sz w:val="44"/><w:szCs w:val="44"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr>
      <w:spacing w:before="400" w:after="120"/>
      <w:pBdr>
        <w:bottom w:val="single" w:sz="6" w:space="1" w:color="1F3864"/>
      </w:pBdr>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="1F3864"/>
      <w:sz w:val="32"/><w:szCs w:val="32"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="80"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="2E4057"/>
      <w:sz w:val="26"/><w:szCs w:val="26"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:pPr>
      <w:ind w:left="720"/>
      <w:spacing w:after="80"/>
    </w:pPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="CodeBlock">
    <w:name w:val="Code Block"/>
    <w:pPr>
      <w:shd w:val="clear" w:color="auto" w:fill="F2F2F2"/>
      <w:ind w:left="360"/>
      <w:spacing w:after="0"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Courier New" w:hAnsi="Courier New" w:cs="Courier New"/>
      <w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr>
  </w:style>

  <w:style w:type="paragraph" w:styleId="CodeLabel">
    <w:name w:val="Code Label"/>
    <w:pPr>
      <w:spacing w:before="240" w:after="40"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:color w:val="666666"/>
      <w:sz w:val="18"/><w:szCs w:val="18"/>
    </w:rPr>
  </w:style>
</w:styles>`;
}

// ── Document body builder ─────────────────────────────────────────────────────

function buildDocumentXml(hostname, cssLink, jsLink, mappings) {
  const mappingLines = (mappings && mappings.length > 0)
    ? mappings.join('\n\n')
    : '// No mappings saved yet.';

  const phpConfig = `function u1_config_and_mapping() {
?>
<script type='text/javascript'>
document.addEventListener('DOMContentLoaded', function () {

    window.u1 = window.u1 || {};

    // Configuration: Visual Focus Border
    window.u1.config = {
        visualFocus: {
            style: { color: 'white', secondaryColor: 'black', doubleBorder: true }
        }
    };

    // Mappings
    ${mappingLines.split('\n').join('\n    ')}

});
</script>
<?php
}
add_action('wp_footer', 'u1_config_and_mapping');`;

  const phpJs = `function add_u1_js() {
?>
<script id="u1Js" src="${jsLink}" type="text/javascript"></script>
<?php
}
add_action('wp_footer', 'add_u1_js');`;

  const htmlCss = `<link id="u1Css" rel="stylesheet" href="${cssLink}">`;

  const bodyParts = [
    // Title
    para(`A Simple Guide to Implementing User1st (${hostname}) in WordPress`, 'Title'),
    emptyPara(),
    para('This guide explains how to implement the User1st system code on your WordPress site in 4 simple steps.', 'Normal'),
    emptyPara(),

    // Step 1
    heading('Step 1: Access the WordPress Theme Editor', 1),
    bullet('Log in to your WordPress site management dashboard.'),
    bullet('From the admin panel left menu, navigate to Appearance and then click on Theme File Editor.'),
    emptyPara(),

    // Step 2
    heading('Step 2: Add the CSS File', 1),
    para('The CSS file is responsible for styling the accessibility components. It should be placed in the site\'s Header.', 'Normal'),
    bullet('In the file list, find and open the header.php file.'),
    bullet('Look for the closing head tag: </head>.'),
    bullet('Paste the following line just before the </head> tag:'),
    emptyPara(),
    para('HTML', 'CodeLabel'),
    codeBlock(htmlCss),
    emptyPara(),

    // Step 3
    heading('Step 3: Add the JS SDK Script', 1),
    para('Now we will add the User1st core system to the bottom of the site (Footer) using a WordPress hook.', 'Normal'),
    bullet('In the Theme File Editor, find and open the functions.php file.'),
    bullet('Scroll to the bottom of the file and paste the following code:'),
    emptyPara(),
    para('PHP', 'CodeLabel'),
    codeBlock(phpJs),
    emptyPara(),

    // Step 4
    heading('Step 4: Configuration and Site Mapping', 1),
    para('In the final step, we will add all the visual settings and the specific accessibility mappings for the site.', 'Normal'),
    bullet('Stay in the functions.php file.'),
    bullet('Paste the following code block below the code you added in the previous step:'),
    emptyPara(),
    para('PHP', 'CodeLabel'),
    codeBlock(phpConfig),
    emptyPara(),
    bullet('Click to save/update the file in WordPress.'),
    emptyPara(),

    // Closing
    para('That\'s it! At this point, the User1st system should be properly implemented and configured on your website.', 'Normal'),
  ];

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document
  xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
${bodyParts.join('\n')}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;
}

// ── Public API ────────────────────────────────────────────────────────────────

function generateAndDownloadDocx(hostname, cssLink, jsLink, mappings) {
  const zip = new ZipWriter();

  zip.add('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/word/document.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml"
    ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`);

  zip.add('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="word/document.xml"/>
</Relationships>`);

  zip.add('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
    Target="styles.xml"/>
</Relationships>`);

  zip.add('word/styles.xml', buildStylesXml());
  zip.add('word/document.xml', buildDocumentXml(hostname, cssLink, jsLink, mappings));

  const bytes = zip.toUint8Array();
  const blob  = new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = `U1-Implementation-Guide-${hostname}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
