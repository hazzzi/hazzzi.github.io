const fs = require("fs");
const path = require("path");

const POSTS_DIR = path.join(__dirname, "posts");
const DOCS_DIR = path.join(__dirname, "docs");
const TEMPLATE_PATH = path.join(__dirname, "template.html");
const GUESTBOOK_ISSUE = 2;
const BASE_URL = "https://hazzzi.github.io";

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

function slugify(text) {
  return text
    .replace(/[<>]/g, "")
    .toLowerCase()
    .replace(/[^\w\s가-힣-]/g, "")
    .replace(/\s+/g, "-");
}

function inline(text, refs = new Map()) {
  // 인라인 코드를 먼저 보호 (내부 마크업 변환 방지)
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, code) => {
    codes.push(`<code>${esc(code)}</code>`);
    return `\x00CODE${codes.length - 1}\x00`;
  });

  // HTML 특수문자 이스케이프
  text = esc(text);

  // 줄바꿈 (trailing 2-space)
  text = text.replace(/ {2,}\n/g, "<br>\n");

  // 이미지
  text = text.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1">'
  );
  // 링크
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // 레퍼런스 링크
  text = text.replace(/\[([^\]]+)\]\[([^\]]*)\]/g, (_, label, ref) => {
    const url = refs.get((ref || label).toLowerCase());
    return url ? `<a href="${esc(url)}">${label}</a>` : _;
  });
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

function parseList(lines, idx, baseIndent, refs) {
  const first = lines[idx].trimStart();
  const isOrdered = /^\d+\.\s/.test(first);
  const tag = isOrdered ? "ol" : "ul";
  let html = `<${tag}>\n`;

  while (idx < lines.length) {
    const line = lines[idx];
    if (line.trim() === "") { idx++; continue; }

    const indent = line.length - line.trimStart().length;
    if (indent < baseIndent) break;

    const stripped = line.trimStart();
    const marker = stripped.match(/^(?:[-*+]|\d+\.)\s+(.*)/);

    if (indent === baseIndent && !marker) break;

    if (indent > baseIndent) {
      if (marker) {
        const nested = parseList(lines, idx, indent, refs);
        html = html.replace(/<\/li>\n$/, "\n" + nested.html + "\n</li>\n");
        idx = nested.endIdx;
      } else {
        html = html.replace(/<\/li>\n$/, " " + inline(stripped, refs) + "</li>\n");
        idx++;
      }
      continue;
    }

    html += `<li>${inline(marker[1], refs)}</li>\n`;
    idx++;
  }

  html += `</${tag}>`;
  return { html, endIdx: idx };
}

function markdownToHtml(md, parentRefs = new Map()) {
  const refs = new Map(parentRefs);
  const lines = [];
  for (const line of md.split("\n")) {
    const rm = line.match(/^\[([^\]]+)\]:\s+(.+)$/);
    if (rm) {
      refs.set(rm[1].toLowerCase(), rm[2].trim());
    } else {
      lines.push(line);
    }
  }
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
        lang
          ? `<fieldset><legend>${esc(lang)}</legend>` +
            `<pre><code>${esc(buf.join("\n"))}</code></pre>` +
            `</fieldset>`
          : `<pre><code>${esc(buf.join("\n"))}</code></pre>`
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

      let table = '<table border="1" cellpadding="6" cellspacing="0" width="100%">\n<thead>\n<tr>\n';
      headers.forEach(
        (h, j) => (table += `<th${aligns[j] || ""}>${inline(h, refs)}</th>\n`)
      );
      table += "</tr>\n</thead>\n<tbody>\n";

      while (i < lines.length && isTableRow(lines[i])) {
        const cells = parseTableCells(lines[i]);
        table += "<tr>\n";
        cells.forEach(
          (c, j) => (table += `<td${aligns[j] || ""}>${inline(c, refs)}</td>\n`)
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
      out.push(`<h${lvl} id="${slugify(hm[2])}">${inline(hm[2], refs)}</h${lvl}>`);
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
      out.push(
        `<table border="0" cellpadding="0" cellspacing="4"><tr>` +
          `<td width="2" bgcolor="gray"></td>` +
          `<td>${markdownToHtml(buf.join("\n"), refs)}</td>` +
          `</tr></table>`
      );
      continue;
    }

    // 리스트 (순서/비순서 통합)
    const listMarker = line.match(/^(\s*)(?:[-*+]|\d+\.)\s/);
    if (listMarker) {
      const result = parseList(lines, i, listMarker[1].length, refs);
      out.push(result.html);
      i = result.endIdx;
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
      !/^[\s]*(?:[-*+]|\d+\.)\s/.test(lines[i]) &&
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
        out.push(`<p>${inline(text, refs)}</p>`);
      }
    }
  }

  return out.join("\n");
}

// ── 날짜 포맷 ─────────────────────────────────────────

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-");
  return `${y}.${m}.${d}`;
}

// ── GitHub Issue 댓글 ────────────────────────────────

async function fetchComments(issueNumber) {
  try {
    const url = `https://api.github.com/repos/hazzzi/hazzzi.github.io/issues/${issueNumber}/comments`;
    const res = await fetch(url, {
      headers: { "User-Agent": "hazzzi-blog-builder" },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

async function fetchAllComments(issueNumbers) {
  const unique = [...new Set(issueNumbers)];
  const entries = await Promise.all(
    unique.map(async (n) => [n, await fetchComments(n)])
  );
  return new Map(entries);
}

function renderComments(comments) {
  let html = "";
  for (const c of comments) {
    const date = formatDate(c.created_at.slice(0, 10));
    html += `<blockquote>\n`;
    html += `<p>${esc(c.body)}</p>\n`;
    html += `<p><small><a href="${esc(c.user.html_url)}">${esc(c.user.login)}</a> · ${date}</small></p>\n`;
    html += `</blockquote>\n`;
  }
  return html;
}

// ── GitHub Issue 자동 생성 ────────────────────────────

async function createIssue(token, post) {
  const res = await fetch(
    "https://api.github.com/repos/hazzzi/hazzzi.github.io/issues",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "hazzzi-blog-builder",
      },
      body: JSON.stringify({
        title: post.title,
        body: `[${post.title}](${BASE_URL}/posts/${post.slug}.html) 댓글 스레드`,
      }),
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.number;
}

function writeIssueToFrontmatter(slug, issueNumber) {
  const filePath = path.join(POSTS_DIR, `${slug}.md`);
  const raw = fs.readFileSync(filePath, "utf-8");
  const match = raw.match(/^(---\r?\n[\s\S]*?)\r?\n(---\r?\n[\s\S]*)$/);
  if (!match) return;
  fs.writeFileSync(filePath, `${match[1]}\nissue: ${issueNumber}\n${match[2]}`);
}

async function ensureIssues(posts) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return;

  const needsIssue = posts.filter((p) => p.issue == null);
  if (needsIssue.length === 0) return;

  console.log(`\n${needsIssue.length}개 포스트에 이슈 생성 중...`);
  for (const post of needsIssue) {
    const issueNumber = await createIssue(token, post);
    if (issueNumber == null) {
      console.log(`  ✗ ${post.slug} — 이슈 생성 실패`);
      continue;
    }
    post.issue = issueNumber;
    writeIssueToFrontmatter(post.slug, issueNumber);
    console.log(`  ✓ ${post.slug} → #${issueNumber}`);
  }
}

// ── 템플릿 ──────────────────────────────────────────

function renderTemplate(tmpl, slots) {
  return tmpl.replace(/\{\{(\w+)\}\}/g, (_, key) => slots[key] ?? "");
}

// ── 파싱: 문자열 → 데이터 (순수) ────────────────────

function parsePost(file, raw) {
  const { meta, body } = parseFrontmatter(raw);
  const slug = file.replace(/\.md$/, "");
  return {
    slug,
    title: meta.title || slug,
    date: meta.date || slug.slice(0, 10),
    description: meta.description || "",
    tags: meta.tags
      ? meta.tags.split(",").map((t) => t.trim()).filter(Boolean)
      : null,
    issue: meta.issue ? Number(meta.issue) : null,
    draft: meta.draft === "true",
    htmlBody: markdownToHtml(body),
  };
}

// ── 페이지 렌더 (순수: 데이터 → HTML) ───────────────

function renderPostPage(template, post, comments, older, newer) {
  const { title, date, description, tags, issue, htmlBody } = post;

  let commentsHtml = "";
  if (issue != null) {
    commentsHtml += `<hr>\n<h2 id="comments-title">댓글 ${comments.length}개</h2>\n`;
    commentsHtml += `<div id="comments">\n`;
    if (comments.length > 0) {
      commentsHtml += renderComments(comments);
    } else {
      commentsHtml += `<p>아직 댓글이 없어요.</p>\n`;
    }
    commentsHtml += `</div>\n`;
    commentsHtml += `<table border="1" cellpadding="8" cellspacing="0">\n<tr><td>\n`;
    commentsHtml += `  <b><a href="https://github.com/hazzzi/hazzzi.github.io/issues/${issue}">GitHub에서 댓글 남기기</a></b>\n`;
    commentsHtml += `  <br><small>GitHub 계정으로 로그인 후 이슈에 코멘트를 남기면 여기에 표시돼요.</small>\n`;
    commentsHtml += `</td></tr>\n</table>\n`;

    commentsHtml += `<script>
(function(){
  var issue = ${issue};
  var $c = document.getElementById("comments");
  var $t = document.getElementById("comments-title");
  fetch("https://api.github.com/repos/hazzzi/hazzzi.github.io/issues/" + issue + "/comments")
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!Array.isArray(data)) return;
      $t.textContent = "댓글 " + data.length + "개";
      if (!data.length) { $c.innerHTML = "<p>아직 댓글이 없어요.</p>"; return; }
      var h = "";
      data.forEach(function(c){
        var d = c.created_at.slice(0,10).replace(/-/g,".");
        var body = c.body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        h += "<blockquote><p>" + body + "</p>"
           + "<p><small><a href=\\"" + c.user.html_url + "\\">" + c.user.login + "</a> · " + d + "</small></p></blockquote>";
      });
      $c.innerHTML = h;
    })
    .catch(function(){});
})();
<\/script>\n`;
  }

  const metaLine = [
    formatDate(date),
    description || null,
    tags ? tags.map(t => `#${t}`).join(" ") : null,
  ].filter(Boolean).join(" · ");

  let navHtml = `<nav>\n<p><a href="/">← 글 목록</a></p>\n`;
  if (older || newer) {
    navHtml += `<table width="100%" role="presentation">\n<tr>\n`;
    navHtml += `<td>${older ? `<a href="/posts/${older.slug}.html">← ${esc(older.title)}</a>` : ""}</td>\n`;
    navHtml += `<td align="right">${newer ? `<a href="/posts/${newer.slug}.html">${esc(newer.title)} →</a>` : ""}</td>\n`;
    navHtml += `</tr>\n</table>\n`;
  }
  navHtml += `</nav>`;

  const content = `<h1>${esc(title)}</h1>
<p><small>${metaLine}</small></p>
<hr>
<article>
${htmlBody}
${commentsHtml}
<hr>
${navHtml}
</article>`;

  return renderTemplate(template, {
    title: `${esc(title)} — 하은 블로그`,
    description: esc(description || title),
    og_type: "article",
    url: `${BASE_URL}/posts/${post.slug}.html`,
    content,
  });
}

function renderIndexPage(template, posts) {
  let listHtml = "";
  if (posts.length === 0) {
    listHtml = "<p>아직 글이 없습니다.</p>";
  } else {
    listHtml += `<ul>\n`;
    for (const p of posts) {
      listHtml += `<li>\n`;
      listHtml += `<p>${formatDate(p.date)} — <a href="/posts/${p.slug}.html"><strong>${esc(p.title)}</strong></a>`;
      if (p.description)
        listHtml += `<br><small>${esc(p.description)}</small>`;
      if (p.tags)
        listHtml += `<br>${p.tags.map((t) => `<kbd>#${esc(t)}</kbd>`).join(" ")}`;
      listHtml += `</p>\n`;
      listHtml += `</li>\n`;
    }
    listHtml += `</ul>\n`;
  }

  return renderTemplate(template, {
    title: "하은 블로그",
    description: "하은 블로그",
    og_type: "website",
    url: BASE_URL,
    content: listHtml,
  });
}

function renderGuestbookPage(template, comments) {
  let html = `<h1>발자취 🐾</h1>\n`;
  html += `<h2 id="comments-title">발자취 ${comments.length}개</h2>\n`;
  html += `<div id="comments">\n`;
  if (comments.length === 0) {
    html += `<p>아직 발자취가 없어요.</p>\n`;
  } else {
    html += renderComments(comments);
  }
  html += `</div>\n`;
  html += `<table border="1" cellpadding="8" cellspacing="0">\n<tr><td>\n`;
  html += `  <b><a href="https://github.com/hazzzi/hazzzi.github.io/issues/${GUESTBOOK_ISSUE}">GitHub에서 발자취 남기기</a></b>\n`;
  html += `  <br><small>GitHub 계정으로 로그인 후 이슈에 코멘트를 남기면 여기에 표시돼요.</small>\n`;
  html += `</td></tr>\n</table>\n`;

  html += `<script>
(function(){
  var issue = ${GUESTBOOK_ISSUE};
  var $c = document.getElementById("comments");
  var $t = document.getElementById("comments-title");
  fetch("https://api.github.com/repos/hazzzi/hazzzi.github.io/issues/" + issue + "/comments")
    .then(function(r){ return r.json(); })
    .then(function(data){
      if (!Array.isArray(data)) return;
      $t.textContent = "발자취 " + data.length + "개";
      if (!data.length) { $c.innerHTML = "<p>아직 발자취가 없어요.</p>"; return; }
      var h = "";
      data.forEach(function(c){
        var d = c.created_at.slice(0,10).replace(/-/g,".");
        var body = c.body.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
        h += "<blockquote><p>" + body + "</p>"
           + "<p><small><a href=\\"" + c.user.html_url + "\\">" + c.user.login + "</a> · " + d + "</small></p></blockquote>";
      });
      $c.innerHTML = h;
    })
    .catch(function(){});
})();
<\/script>\n`;

  html += `<p><a href="/">← 글 목록</a></p>\n`;

  return renderTemplate(template, {
    title: "발자취 — 하은 블로그",
    description: "발자취를 남겨주세요",
    og_type: "website",
    url: `${BASE_URL}/guestbook.html`,
    content: html,
  });
}

// ── RSS 피드 ─────────────────────────────────────────

function renderFeed(posts) {
  const items = posts.map(p => `  <item>
    <title>${esc(p.title)}</title>
    <link>${BASE_URL}/posts/${p.slug}.html</link>
    <guid>${BASE_URL}/posts/${p.slug}.html</guid>
    <pubDate>${new Date(p.date).toUTCString()}</pubDate>
    <description>${esc(p.description || p.title)}</description>
  </item>`).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
  <title>하은 블로그</title>
  <link>${BASE_URL}</link>
  <description>하은 블로그</description>
  <language>ko</language>
  <atom:link href="${BASE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
</channel>
</rss>`;
}

// ── Sitemap ──────────────────────────────────────────

function renderSitemap(posts) {
  const urls = [
    `  <url><loc>${BASE_URL}/</loc></url>`,
    `  <url><loc>${BASE_URL}/guestbook.html</loc></url>`,
    `  <url><loc>${BASE_URL}/about.html</loc></url>`,
    ...posts.map(p =>
      `  <url><loc>${BASE_URL}/posts/${p.slug}.html</loc><lastmod>${p.date}</lastmod></url>`
    ),
  ].join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`;
}

function renderRobotsTxt() {
  return `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
}

// ── 소개 페이지 ──────────────────────────────────────

function renderAboutPage(template) {
  const content = `<h1>about</h1>
<p>하은이라고 합니다.</p>
<p>관심 있는 건 추상화, 함수형 프로그래밍, AI. 대충 그런 것들.</p>
<p>이 블로그는 CSS가 없습니다.<br>
프레임워크도 없고, 빌드 도구도 없고, 그냥 HTML입니다.<br>
이유는 별거 없고, 재밌을 것 같아서.</p>
<p>기술 얘기도 하고, 그때그때 생각나는 거 적어두는 블로그예요.</p>
<p><a href="https://github.com/hazzzi">GitHub</a></p>
<p><a href="/">← 글 목록</a></p>`;

  return renderTemplate(template, {
    title: "about — 하은 블로그",
    description: "하은 블로그 소개",
    og_type: "website",
    url: `${BASE_URL}/about.html`,
    content,
  });
}

// ── 404 페이지 ───────────────────────────────────────

function render404Page(template) {
  return renderTemplate(template, {
    title: "404 — 하은 블로그",
    description: "페이지를 찾을 수 없습니다",
    og_type: "website",
    url: BASE_URL,
    content: `<h1>404</h1>\n<p>페이지를 찾을 수 없습니다.</p>\n<p><a href="/">← 글 목록으로</a></p>`,
  });
}

// ── 빌드: 오케스트레이션 ─────────────────────────────

async function build() {
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

  // 파일 읽기 → 데이터 파싱
  const files = fs
    .readdirSync(POSTS_DIR)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .reverse();
  const allPosts = files.map((file) => {
    const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
    return parsePost(file, raw);
  });

  const drafts = allPosts.filter((p) => p.draft);
  const posts = allPosts.filter((p) => !p.draft);
  if (drafts.length > 0) {
    console.log(`${drafts.length}개 드래프트 건너뜀: ${drafts.map((d) => d.slug).join(", ")}`);
  }

  // 이슈 없는 포스트에 자동 생성 (GITHUB_TOKEN 있을 때만)
  await ensureIssues(posts);

  // 댓글 병렬 fetch
  const issueNumbers = [
    ...posts.filter((p) => p.issue != null).map((p) => p.issue),
    GUESTBOOK_ISSUE,
  ];
  const commentsMap = await fetchAllComments(issueNumbers);

  // 포스트 페이지 렌더 → 디스크 쓰기
  // posts는 최신순. older = 이전(오래된) 글, newer = 다음(최근) 글
  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    const comments = commentsMap.get(post.issue) ?? [];
    const older = posts[i + 1] || null;
    const newer = posts[i - 1] || null;
    const html = renderPostPage(template, post, comments, older, newer);
    fs.writeFileSync(path.join(DOCS_DIR, "posts", `${post.slug}.html`), html);
    console.log(`  ✓ ${post.slug}.md`);
  }

  // 인덱스 페이지
  const indexHtml = renderIndexPage(template, posts);
  fs.writeFileSync(path.join(DOCS_DIR, "index.html"), indexHtml);
  console.log(`\n${posts.length}개 글 빌드 완료`);

  // 방명록 페이지
  const guestbookComments = commentsMap.get(GUESTBOOK_ISSUE) ?? [];
  const guestbookHtml = renderGuestbookPage(template, guestbookComments);
  fs.writeFileSync(path.join(DOCS_DIR, "guestbook.html"), guestbookHtml);
  console.log(`발자취 ${guestbookComments.length}개 렌더 완료`);

  // RSS 피드
  const feedXml = renderFeed(posts);
  fs.writeFileSync(path.join(DOCS_DIR, "feed.xml"), feedXml);
  console.log("feed.xml 생성 완료");

  // 404 페이지
  const notFoundHtml = render404Page(template);
  fs.writeFileSync(path.join(DOCS_DIR, "404.html"), notFoundHtml);
  console.log("404.html 생성 완료");

  // 소개 페이지
  const aboutHtml = renderAboutPage(template);
  fs.writeFileSync(path.join(DOCS_DIR, "about.html"), aboutHtml);
  console.log("about.html 생성 완료");

  // Sitemap + robots.txt
  fs.writeFileSync(path.join(DOCS_DIR, "sitemap.xml"), renderSitemap(posts));
  fs.writeFileSync(path.join(DOCS_DIR, "robots.txt"), renderRobotsTxt());
  console.log("sitemap.xml, robots.txt 생성 완료");
}

build();
