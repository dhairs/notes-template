import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeRewrite from "rehype-rewrite";
import rehypeStringify from "rehype-stringify";
import remarkMath from "remark-math";
import rehypeMathjax from "rehype-mathjax";

import {
  getLinksMapping,
  getPostBySlug,
  getSlugFromHref,
  updateMarkdownLinks,
} from "./api";
import removeMd from "remove-markdown";
import { Element } from "hast-util-select";
import { renderToStaticMarkup } from "react-dom/server";
import NotePreview from "../components/misc/note-preview";
import { fromHtml } from "hast-util-from-html";

export async function markdownToHtml(markdown, currSlug) {
  markdown = updateMarkdownLinks(markdown, currSlug);

  // get mapping of current links
  const links = getLinksMapping()[currSlug];
  const linkNodeMapping = new Map();
  for (const l of links) {
    const post = getPostBySlug(l, ["title", "content"]);
    const node = createNoteNode(post.title, post.content);
    linkNodeMapping[l] = node;
  }

  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeMathjax)
    .use(rehypeRewrite, {
      selector: "a",
      rewrite: async (node) =>
        rewriteLinkNodes(node, linkNodeMapping, currSlug),
    })
    .use(rehypeStringify)
    .process(markdown);
  let htmlStr = file.toString();
  return htmlStr;
}

export function getMDExcerpt(markdown, length = 500) {
  const text = removeMd(markdown, {
    stripListLeaders: false,
    gfm: true,
  });
  return text.slice(0, length).trim();
}

export function createNoteNode(title, content) {
  const mdContentStr = getMDExcerpt(content);
  const htmlStr = renderToStaticMarkup(
    NotePreview({ title, content: mdContentStr })
  );
  const noteNode = fromHtml(htmlStr);
  return noteNode;
}

function rewriteLinkNodes(node, linkNodeMapping, currSlug) {
  if (node.type === "element" && node.tagName === "a") {
    const slug = getSlugFromHref(currSlug, node.properties.href);
    const noteCardNode = linkNodeMapping[slug];
    if (noteCardNode) {
      const anchorNode = { ...node };
      anchorNode.properties.className = "internal-link";
      node.tagName = "span";
      node.properties = { className: "internal-link-container" };
      node.children = [anchorNode, noteCardNode];
    }
  }
}
