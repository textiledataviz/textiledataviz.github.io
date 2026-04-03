import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import type { FileTrieNode } from "./quartz/util/fileTrie"

const explorerSortFn = (a: FileTrieNode, b: FileTrieNode) => {
  const folderOrder: Record<string, number> = {
    Textiles: 0,
    Data: 1,
    Examples: 2,
  }

  // Keep folders before files, then apply custom folder ordering.
  if (a.isFolder !== b.isFolder) {
    return a.isFolder ? -1 : 1
  }

  const aOrder = folderOrder[a.displayName] ?? folderOrder[a.slugSegment]
  const bOrder = folderOrder[b.displayName] ?? folderOrder[b.slugSegment]
  if (aOrder !== undefined && bOrder !== undefined) {
    return aOrder - bOrder
  }
  if (aOrder !== undefined) {
    return -1
  }
  if (bOrder !== undefined) {
    return 1
  }

  return a.displayName.localeCompare(b.displayName, undefined, {
    numeric: true,
    sensitivity: "base",
  })
}

const explorerFilterFn = (node: FileTrieNode) => {
  const slug = node.slugSegment.toLowerCase()
  return slug !== "tags" && slug !== "properties"
}

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [],
  afterBody: [],
  footer: Component.Footer({
    links: {
      "by Quinn Daedal": "https://quinndaedal.com",
      "Textile Makerspace/YarnLab": "https://textilemakerspace.stanford.edu",
      "#DHmakes feed": "https://bsky.app/profile/literaturegeek.bsky.social/feed/aaadokeexl2vo",
    },
  }),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleTitle(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
        //{ Component: Component.ReaderMode() },
      ],
    }),
    Component.Explorer({ sortFn: explorerSortFn, filterFn: explorerFilterFn }),
  ],
  right: [
    Component.Graph(),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ConditionalRender({
      component: Component.ExamplesGallery(),
      condition: (page) => page.fileData.slug === "Examples/index" || page.fileData.slug === "Examples",
    }),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Flex({
      components: [
        {
          Component: Component.Search(),
          grow: true,
        },
        { Component: Component.Darkmode() },
      ],
    }),
    Component.Explorer({ sortFn: explorerSortFn, filterFn: explorerFilterFn }),
  ],
  right: [],
}
