const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const CACHE_DIR = path.join(__dirname, ".cache", "og");
const OG_DIR = path.join(__dirname, "docs", "og");

// ── SVG 이스케이프 ──────────────────────────────────────

function escSvg(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── 제목 줄바꿈 ────────────────────────────────────────
//
// 한글은 글자 단위로 끊을 수 있고, 영단어는 공백 기준.
// 한 줄 최대 약 12~14자 (font-size 80, 900px 영역).
// 최대 3줄. 넘치면 폰트 축소 (80 → 60 → 48).

function isHangul(ch) {
  const code = ch.charCodeAt(0);
  return code >= 0xac00 && code <= 0xd7a3;
}

function splitTitle(title, maxCharsPerLine) {
  const tokens = [];
  let buf = "";

  for (const ch of title) {
    if (ch === " ") {
      if (buf) tokens.push(buf);
      tokens.push(" ");
      buf = "";
    } else if (isHangul(ch)) {
      if (buf && !isHangul(buf[buf.length - 1])) {
        tokens.push(buf);
        buf = "";
      }
      buf += ch;
    } else {
      if (buf && isHangul(buf[buf.length - 1])) {
        tokens.push(buf);
        buf = "";
      }
      buf += ch;
    }
  }
  if (buf) tokens.push(buf);

  const lines = [];
  let currentLine = "";

  for (const token of tokens) {
    if (token === " ") {
      if (currentLine.length > 0 && currentLine.length < maxCharsPerLine) {
        currentLine += " ";
      }
      continue;
    }

    // 한글 토큰은 글자 단위로 끊기 가능
    if (isHangul(token[0])) {
      for (const ch of token) {
        if (currentLine.length >= maxCharsPerLine) {
          lines.push(currentLine.trimEnd());
          currentLine = "";
        }
        currentLine += ch;
      }
    } else {
      // 영단어는 통째로
      if (currentLine.length + token.length > maxCharsPerLine && currentLine.length > 0) {
        lines.push(currentLine.trimEnd());
        currentLine = "";
      }
      currentLine += token;
    }
  }
  if (currentLine.trimEnd()) lines.push(currentLine.trimEnd());

  return lines;
}

function layoutTitle(title) {
  const sizes = [
    { fontSize: 80, maxChars: 13, maxLines: 3, lineHeight: 100 },
    { fontSize: 60, maxChars: 17, maxLines: 4, lineHeight: 76 },
    { fontSize: 48, maxChars: 22, maxLines: 5, lineHeight: 62 },
  ];

  for (const { fontSize, maxChars, maxLines, lineHeight } of sizes) {
    const lines = splitTitle(title, maxChars);
    if (lines.length <= maxLines) {
      return { lines, fontSize, lineHeight };
    }
  }

  // 최소 사이즈로 강제 (넘쳐도 자름)
  const last = sizes[sizes.length - 1];
  const lines = splitTitle(title, last.maxChars).slice(0, last.maxLines);
  return { lines, fontSize: last.fontSize, lineHeight: last.lineHeight };
}

// ── SVG 생성 ────────────────────────────────────────────

function buildSvg(title) {
  const { lines, fontSize, lineHeight } = layoutTitle(title);

  // 텍스트 영역: y=94 ~ y=594 (높이 500px), x=120 ~ x=1084 (스크롤바 제외)
  const textAreaTop = 94;
  const textAreaHeight = 500;
  const totalTextHeight = lines.length * lineHeight;
  const startY = textAreaTop + (textAreaHeight - totalTextHeight) / 2 + fontSize * 0.8;

  const tspans = lines.map((line, i) => {
    const y = startY + i * lineHeight;
    return `<tspan x="160" y="${y}">${escSvg(line)}</tspan>`;
  }).join("\n    ");

  // 커서: 마지막 줄 오른쪽 끝 근처
  // 한글(전각)과 영문(반각)의 너비 차이를 반영
  const lastLineY = startY + (lines.length - 1) * lineHeight;
  const lastLine = lines[lines.length - 1];
  let lastLineWidth = 0;
  for (const ch of lastLine) {
    if (ch === " ") {
      lastLineWidth += fontSize * 0.28;
    } else if (isHangul(ch)) {
      lastLineWidth += fontSize * 0.88;
    } else {
      lastLineWidth += fontSize * 0.62;
    }
  }
  const cursorX = 160 + lastLineWidth + fontSize * 0.05;
  const cursorY = lastLineY - fontSize * 0.7;
  const cursorHeight = fontSize * 0.9;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <linearGradient id="titleBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#00007b"/>
      <stop offset="100%" style="stop-color:#0863ce"/>
    </linearGradient>
  </defs>

  <!-- Win98 바탕화면 -->
  <rect width="1200" height="630" fill="#3a6ea5"/>

  <!-- 윈도우 그림자 -->
  <rect x="102" y="42" width="1020" height="560" fill="#000000" opacity="0.15"/>

  <!-- 윈도우 외곽 + 3D 테두리 -->
  <rect x="98" y="38" width="1020" height="560" fill="#c0c0c0"/>
  <rect x="98" y="38" width="1020" height="1" fill="#dfdfdf"/>
  <rect x="98" y="38" width="1" height="560" fill="#dfdfdf"/>
  <rect x="99" y="39" width="1018" height="1" fill="#ffffff"/>
  <rect x="99" y="39" width="1" height="558" fill="#ffffff"/>
  <rect x="98" y="597" width="1020" height="1" fill="#404040"/>
  <rect x="1117" y="38" width="1" height="560" fill="#404040"/>
  <rect x="99" y="596" width="1018" height="1" fill="#808080"/>
  <rect x="1116" y="39" width="1" height="558" fill="#808080"/>

  <!-- 타이틀바 -->
  <rect x="102" y="42" width="1012" height="26" fill="url(#titleBar)"/>
  <text x="114" y="60" fill="white" font-family="'Tahoma', 'Arial', sans-serif" font-size="13" font-weight="bold">hazzzi.github.io - Notepad</text>

  <!-- 최소화/최대화/닫기 버튼 -->
  <rect x="1054" y="45" width="18" height="17" fill="#c0c0c0"/>
  <rect x="1054" y="45" width="18" height="1" fill="#fff"/>
  <rect x="1054" y="45" width="1" height="17" fill="#fff"/>
  <rect x="1071" y="45" width="1" height="17" fill="#404040"/>
  <rect x="1054" y="61" width="18" height="1" fill="#404040"/>
  <line x1="1058" y1="57" x2="1067" y2="57" stroke="#000" stroke-width="1.5"/>
  <rect x="1074" y="45" width="18" height="17" fill="#c0c0c0"/>
  <rect x="1074" y="45" width="18" height="1" fill="#fff"/>
  <rect x="1074" y="45" width="1" height="17" fill="#fff"/>
  <rect x="1091" y="45" width="1" height="17" fill="#404040"/>
  <rect x="1074" y="61" width="18" height="1" fill="#404040"/>
  <rect x="1078" y="49" width="10" height="9" fill="none" stroke="#000" stroke-width="1"/>
  <line x1="1078" y1="51" x2="1088" y2="51" stroke="#000" stroke-width="1.5"/>
  <rect x="1094" y="45" width="18" height="17" fill="#c0c0c0"/>
  <rect x="1094" y="45" width="18" height="1" fill="#fff"/>
  <rect x="1094" y="45" width="1" height="17" fill="#fff"/>
  <rect x="1111" y="45" width="1" height="17" fill="#404040"/>
  <rect x="1094" y="61" width="18" height="1" fill="#404040"/>
  <line x1="1099" y1="49" x2="1107" y2="57" stroke="#000" stroke-width="1.5"/>
  <line x1="1107" y1="49" x2="1099" y2="57" stroke="#000" stroke-width="1.5"/>

  <!-- 메뉴바 -->
  <rect x="102" y="68" width="1012" height="22" fill="#c0c0c0"/>
  <text x="114" y="83" fill="#000" font-family="'Tahoma', 'Arial', sans-serif" font-size="12">File   Edit   Search   Help</text>

  <!-- 텍스트 영역 -->
  <rect x="104" y="92" width="1012" height="502" fill="#808080"/>
  <rect x="105" y="93" width="1011" height="501" fill="#404040"/>
  <rect x="106" y="94" width="1010" height="500" fill="#ffffff"/>
  <rect x="106" y="593" width="1010" height="1" fill="#dfdfdf"/>
  <rect x="1115" y="94" width="1" height="500" fill="#dfdfdf"/>

  <!-- 제목 -->
  <text font-size="${fontSize}" font-weight="900" font-family="'Arial Black', 'Arial', sans-serif" fill="#000000">
    ${tspans}
  </text>

  <!-- 커서 -->
  <rect x="${Math.round(cursorX)}" y="${Math.round(cursorY)}" width="4" height="${Math.round(cursorHeight)}" fill="#000000"/>

  <!-- 우측 스크롤바 -->
  <rect x="1098" y="94" width="16" height="500" fill="#c0c0c0"/>
  <rect x="1098" y="94" width="16" height="16" fill="#c0c0c0"/>
  <rect x="1098" y="94" width="16" height="1" fill="#fff"/>
  <rect x="1098" y="94" width="1" height="16" fill="#fff"/>
  <rect x="1113" y="94" width="1" height="16" fill="#404040"/>
  <rect x="1098" y="109" width="16" height="1" fill="#404040"/>
  <rect x="1098" y="578" width="16" height="16" fill="#c0c0c0"/>
  <rect x="1098" y="578" width="16" height="1" fill="#fff"/>
  <rect x="1098" y="578" width="1" height="16" fill="#fff"/>
  <rect x="1113" y="578" width="1" height="16" fill="#404040"/>
  <rect x="1098" y="593" width="16" height="1" fill="#404040"/>
  <rect x="1099" y="116" width="14" height="50" fill="#c0c0c0"/>
  <rect x="1099" y="116" width="14" height="1" fill="#fff"/>
  <rect x="1099" y="116" width="1" height="50" fill="#fff"/>
  <rect x="1112" y="116" width="1" height="50" fill="#404040"/>
  <rect x="1099" y="165" width="14" height="1" fill="#404040"/>
</svg>`;
}

// ── PNG 변환 ────────────────────────────────────────────

function svgToPng(svgString) {
  const resvg = new Resvg(svgString, {
    fitTo: { mode: "width", value: 1200 },
    font: {
      loadSystemFonts: true,
    },
  });
  const pngData = resvg.render();
  return pngData.asPng();
}

// ── 메인 ────────────────────────────────────────────────

async function generateOgImages(posts) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  fs.mkdirSync(OG_DIR, { recursive: true });

  let generated = 0;
  let skipped = 0;

  function ensureImage(slug, title) {
    const cachePath = path.join(CACHE_DIR, `${slug}.png`);
    const outPath = path.join(OG_DIR, `${slug}.png`);

    if (fs.existsSync(cachePath)) {
      fs.copyFileSync(cachePath, outPath);
      skipped++;
      return;
    }

    const svg = buildSvg(title);
    const png = svgToPng(svg);
    fs.writeFileSync(cachePath, png);
    fs.copyFileSync(cachePath, outPath);
    generated++;
    console.log(`  og: ${slug}.png`);
  }

  // 포스트별 OG 이미지
  for (const post of posts) {
    ensureImage(post.slug, post.title);
  }

  // 기본 OG 이미지
  ensureImage("default", "HAZZZI");

  console.log(`OG 이미지: ${generated}개 생성, ${skipped}개 스킵`);
}

module.exports = { generateOgImages };
