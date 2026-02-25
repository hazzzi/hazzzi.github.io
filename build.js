const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "posts");
const DOCS_DIR = path.join(__dirname, "docs");
const TEMPLATE_PATH = path.join(__dirname, "template.html");

// ── Frontmatter ───────────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  });

  return { meta, body: match[2] };
}

// ── Markdown → HTML ───────────────────────────────────

function esc(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function inline(text) {
  // 인라인 코드를 먼저 보호 (내부 마크업 변환 방지)
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${esc(code)}</code>`);
    return `\x00CODE${codes.length - 1}\x00`;
  });

  // 이미지
  text = text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1">'
  );
  // 링크
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // 볼드
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__(.+?)__/g, "<strong>$1</strong>");
  // 이탤릭
  text = text.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");
  text = text.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, "<em>$1</em>");
  // 취소선
  text = text.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // 인라인 코드 복원
  text = text.replace(/\x00CODE(\d+)\x00/g, (_, i) => codes[i]);

  return text;
}

function isTableRow(line) {
  return line.trim().startsWith("|") && line.trim().endsWith("|");
}

function isSeparatorRow(line) {
  return /^\|[\s:]*-{3,}[\s:]*(\|[\s:]*-{3,}[\s:]*)*\|$/.test(line.trim());
}

function parseTableCells(line) {
  return line
    .trim()
    .slice(1, -1)
    .split("|")
    .map((c) => c.trim());
}

function parseAlignments(line) {
  return parseTableCells(line).map((cell) => {
    const left = cell.startsWith(":");
    const right = cell.endsWith(":");
    if (left && right) return ' align="center"';
    if (right) return ' align="right"';
    return "";
  });
}

function markdownToHtml(md) {
  const lines = md.split("\n");
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 빈 줄
    if (line.trim() === "") {
      i++;
      continue;
    }

    // 코드 블록
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        buf.push(lines[i]);
        i++;
      }
      i++;
      out.push(
        `<figure>` +
          `<pre><code>${esc(buf.join("\n"))}</code></pre>` +
          (lang ? `<figcaption>${esc(lang)}</figcaption>` : "") +
          `</figure>`
      );
      continue;
    }

    // 테이블
    if (
      isTableRow(line) &&
      i + 1 < lines.length &&
      isSeparatorRow(lines[i + 1])
    ) {
      const headers = parseTableCells(line);
      const aligns = parseAlignments(lines[i + 1]);
      i += 2;

      let table = "<table>\n<thead>\n<tr>\n";
      headers.forEach(
        (h, j) => (table += `<th${aligns[j] || ""}>${inline(h)}</th>\n`)
      );
      table += "</tr>\n</thead>\n<tbody>\n";

      while (i < lines.length && isTableRow(lines[i])) {
        const cells = parseTableCells(lines[i]);
        table += "<tr>\n";
        cells.forEach(
          (c, j) => (table += `<td${aligns[j] || ""}>${inline(c)}</td>\n`)
        );
        table += "</tr>\n";
        i++;
      }

      table += "</tbody>\n</table>";
      out.push(table);
      continue;
    }

    // 헤더
    const hm = line.match(/^(#{1,6})\s+(.+)/);
    if (hm) {
      const lvl = hm[1].length;
      out.push(`<h${lvl}>${inline(hm[2])}</h${lvl}>`);
      i++;
      continue;
    }

    // 수평선
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      out.push("<hr>");
      i++;
      continue;
    }

    // 인용문
    if (line.trim().startsWith(">")) {
      const buf = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      out.push(`<blockquote>${markdownToHtml(buf.join("\n"))}</blockquote>`);
      continue;
    }

    // 비순서 목록
    if (/^[\s]*[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*+]\s/, ""));
        i++;
      }
      out.push(
        "<ul>\n" +
          items.map((item) => `<li>${inline(item)}</li>`).join("\n") +
          "\n</ul>"
      );
      continue;
    }

    // 순서 목록
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      out.push(
        "<ol>\n" +
          items.map((item) => `<li>${inline(item)}</li>`).join("\n") +
          "\n</ol>"
      );
      continue;
    }

    // 문단
    const buf = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^[\s]*[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim()) &&
      !isTableRow(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }

    if (buf.length > 0) {
      const text = buf.join("\n");
      // 이미지만 있는 문단은 <figure>로 감싸기
      if (/^!\[([^\]]*)\]\(([^)]+)\)$/.test(text.trim())) {
        const m = text.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
        out.push(
          `<figure>` +
            `<img src="${m[2]}" alt="${esc(m[1])}">` +
            (m[1] ? `<figcaption>${esc(m[1])}</figcaption>` : "") +
            `</figure>`
        );
      } else {
        out.push(`<p>${inline(text)}</p>`);
      }
    }
  }

  return out.join("\n");
}

// ── 날짜 포맷 ─────────────────────────────────────────

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${y}년 ${Number(m)}월 ${Number(d)}일`;
}

// ── 빌드 ──────────────────────────────────────────────

function build() {
  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  if (fs.existsSync(DOCS_DIR)) {
    fs.rmSync(DOCS_DIR, { recursive: true });
  }
  fs.mkdirSync(path.join(DOCS_DIR, "posts"), { recursive: true });

  if (!fs.existsSync(POSTS_DIR)) {
    fs.mkdirSync(POSTS_DIR, { recursive: true });
    console.log("posts/ 폴더가 비어 있습니다.");
    return;
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();

  const posts = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    const { meta, body } = parseFrontmatter(raw);

    const slug = file.replace(/\.md$/, "");
    const title = meta.title || slug;
    const date = meta.date || slug.slice(0, 10);
    const description = meta.description || "";
    const htmlBody = markdownToHtml(body);

    const postContent = `<article>
<h1>${esc(title)}</h1>
<p><time datetime="${date}">${formatDate(date)}</time></p>
${htmlBody}
<p><a href="/">← home</a></p>
</article>`;

    const postHtml = template
      .replace("{{title}}", `${esc(title)} — hazzzi`)
      .replace("{{description}}", esc(description || title))
      .replace("{{content}}", postContent);

    fs.writeFileSync(path.join(DOCS_DIR, "posts", `${slug}.html`), postHtml);
    posts.push({ title, date, description, slug });
    console.log(`  ✓ ${file}`);
  }

  // 인덱스
  let aboutHtml =
    `<details>\n` +
    `<summary>about</summary>\n` +
    `<p>개발하고 글 씁니다. 가끔은 삽질 기록도.</p>\n` +
    `</details>\n`;

  let listHtml = "";
  if (posts.length === 0) {
    listHtml = "<p>아직 글이 없습니다.</p>";
  } else {
    for (const p of posts) {
      listHtml += `<fieldset>\n`;
      listHtml += `<legend>${formatDate(p.date)}</legend>\n`;
      listHtml += `<p><a href="/posts/${p.slug}.html"><strong>${esc(p.title)}</strong></a></p>\n`;
      if (p.description) listHtml += `<p><small>${esc(p.description)}</small></p>\n`;
      listHtml += `</fieldset>\n`;
    }
  }

  const indexContent = aboutHtml + listHtml;

  const indexHtml = template
    .replace("{{title}}", "hazzzi")
    .replace("{{description}}", "hazzzi의 개발 블로그")
    .replace("{{content}}", indexContent);

  fs.writeFileSync(path.join(DOCS_DIR, "index.html"), indexHtml);
  console.log(`\n${posts.length}개 글 빌드 완료`);
}

build();
