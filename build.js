const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "posts");
const DOCS_DIR = path.join(__dirname, "docs");
const TEMPLATE_PATH = path.join(__dirname, "template.html");

// ── Frontmatter 파서 ──────────────────────────────────

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta = {};
  match[1].split("\n").forEach((line) => {
    const idx = line.indexOf(":");
    if (idx === -1) return;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    meta[key] = val;
  });

  return { meta, body: match[2] };
}

// ── 마크다운 → HTML 변환기 ────────────────────────────

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function parseInline(text) {
  // 인라인 코드 (다른 변환보다 먼저 처리)
  text = text.replace(/`([^`]+)`/g, (_, code) => `<code>${escapeHtml(code)}</code>`);
  // 이미지
  text = text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
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

  return text;
}

function markdownToHtml(md) {
  const lines = md.split("\n");
  const result = [];
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
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // 닫는 ``` 건너뛰기
      const escaped = escapeHtml(codeLines.join("\n"));
      result.push(`<pre><code>${escaped}</code></pre>`);
      continue;
    }

    // 헤더
    const headerMatch = line.match(/^(#{1,6})\s+(.+)/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      result.push(`<h${level}>${parseInline(headerMatch[2])}</h${level}>`);
      i++;
      continue;
    }

    // 수평선
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line.trim())) {
      result.push("<hr>");
      i++;
      continue;
    }

    // 인용문
    if (line.trim().startsWith(">")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        quoteLines.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      const inner = markdownToHtml(quoteLines.join("\n"));
      result.push(`<blockquote>${inner}</blockquote>`);
      continue;
    }

    // 비순서 목록
    if (/^[\s]*[-*+]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[\s]*[-*+]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[\s]*[-*+]\s/, ""));
        i++;
      }
      result.push("<ul>");
      items.forEach((item) => result.push(`<li>${parseInline(item)}</li>`));
      result.push("</ul>");
      continue;
    }

    // 순서 목록
    if (/^\d+\.\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\.\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s/, ""));
        i++;
      }
      result.push("<ol>");
      items.forEach((item) => result.push(`<li>${parseInline(item)}</li>`));
      result.push("</ol>");
      continue;
    }

    // 문단
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("#") &&
      !lines[i].trim().startsWith("```") &&
      !lines[i].trim().startsWith(">") &&
      !/^[\s]*[-*+]\s/.test(lines[i]) &&
      !/^\d+\.\s/.test(lines[i]) &&
      !/^(-{3,}|\*{3,}|_{3,})\s*$/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      result.push(`<p>${parseInline(paraLines.join("\n"))}</p>`);
    }
  }

  return result.join("\n");
}

// ── 빌드 프로세스 ─────────────────────────────────────

function build() {
  // 템플릿 읽기
  const template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

  // docs/ 초기화
  if (fs.existsSync(DOCS_DIR)) {
    fs.rmSync(DOCS_DIR, { recursive: true });
  }
  fs.mkdirSync(path.join(DOCS_DIR, "posts"), { recursive: true });

  // posts/ 읽기
  if (!fs.existsSync(POSTS_DIR)) {
    console.log("posts/ 폴더가 없습니다. 생성합니다.");
    fs.mkdirSync(POSTS_DIR, { recursive: true });
    return;
  }

  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse(); // 최신 글이 위로

  const posts = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    const { meta, body } = parseFrontmatter(raw);

    const slug = file.replace(/\.md$/, "");
    const title = meta.title || slug;
    const date = meta.date || slug.slice(0, 10);
    const description = meta.description || "";
    const htmlBody = markdownToHtml(body);

    // 개별 포스트 페이지
    const postContent = `<article>
<header>
<h1>${escapeHtml(title)}</h1>
<p><time datetime="${date}">${date}</time></p>
</header>
${htmlBody}
<footer>
<p><a href="/">← 목록으로</a></p>
</footer>
</article>`;

    const postHtml = template
      .replace("{{title}}", escapeHtml(title))
      .replace("{{content}}", postContent);

    fs.writeFileSync(path.join(DOCS_DIR, "posts", `${slug}.html`), postHtml);
    posts.push({ title, date, description, slug });

    console.log(`  ✓ ${file} → docs/posts/${slug}.html`);
  }

  // 인덱스 페이지
  let listHtml = "";
  if (posts.length === 0) {
    listHtml = "<p>아직 작성된 글이 없습니다.</p>";
  } else {
    listHtml = "<ul>\n";
    for (const post of posts) {
      listHtml += `<li><time datetime="${post.date}">${post.date}</time> — <a href="/posts/${post.slug}.html">${escapeHtml(post.title)}</a>`;
      if (post.description) {
        listHtml += `<br><small>${escapeHtml(post.description)}</small>`;
      }
      listHtml += "</li>\n";
    }
    listHtml += "</ul>";
  }

  const indexContent = `<h2>글 목록</h2>\n${listHtml}`;

  const indexHtml = template
    .replace("{{title}}", "hazzzi blog")
    .replace("{{content}}", indexContent);

  fs.writeFileSync(path.join(DOCS_DIR, "index.html"), indexHtml);

  console.log(`\n빌드 완료: ${posts.length}개의 글 → docs/`);
}

build();
