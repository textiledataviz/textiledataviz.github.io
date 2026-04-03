import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { resolveRelative } from "../util/path"

export default (() => {
  const ExamplesGallery: QuartzComponent = ({ fileData, allFiles }) => {
    if (!fileData.slug) {
      return null
    }

    const folderPrefix = fileData.slug.endsWith("/index")
      ? fileData.slug.slice(0, -"index".length)
      : `${fileData.slug}/`
    const indexSlug = `${folderPrefix}index`

    const pagesWithGallery = allFiles
      .filter((page) => page.slug?.startsWith(folderPrefix))
      .filter((page) => page.slug !== fileData.slug && page.slug !== indexSlug)
      .filter((page) => typeof page.frontmatter?.gallery === "string")
      .sort((a, b) => {
        const aTitle = a.frontmatter?.title ?? ""
        const bTitle = b.frontmatter?.title ?? ""
        return aTitle.localeCompare(bTitle, undefined, { numeric: true, sensitivity: "base" })
      })

    if (pagesWithGallery.length === 0) {
      return null
    }

    const allTags = [...
      new Set(
        pagesWithGallery
          .flatMap((page) => {
            const tags = page.frontmatter?.tags
            if (Array.isArray(tags)) {
              return tags
            }
            if (typeof tags === "string") {
              return [tags]
            }
            return []
          })
          .map((tag) => tag.trim())
          .filter((tag) => tag.length > 0),
      ),
    ].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))

    return (
      <section class="examples-gallery-root" aria-label="Folder gallery">
        <div class="examples-gallery-controls">
          <label>
            Filter by tag:
            <select class="examples-gallery-filter" aria-label="Filter examples by tag">
              <option value="all">All</option>
              {allTags.map((tag) => (
                <option value={tag.toLowerCase()}>{tag}</option>
              ))}
            </select>
          </label>
        </div>
        <div class="examples-gallery">
          {pagesWithGallery.map((page) => {
            const title = page.frontmatter?.title ?? page.slug!
            const artist =
              typeof page.frontmatter?.artist === "string" ? page.frontmatter.artist : undefined
            const imageName = page.frontmatter!.gallery as string
            const href = resolveRelative(fileData.slug!, page.slug!)
            const imgSrc = `/assets/examples/${imageName}`
            const tags = page.frontmatter?.tags
            const tagList = Array.isArray(tags)
              ? tags
              : typeof tags === "string"
                ? [tags]
                : []

            return (
              <a
                class="examples-gallery-card"
                href={href}
                title={artist ? `${title} — ${artist}` : title}
                data-tags={tagList.map((tag) => tag.toLowerCase()).join("|")}
              >
                <img src={imgSrc} alt={title} loading="lazy" />
                <span class="examples-gallery-title">
                  <span class="examples-gallery-title-main">{title}</span>
                  {artist && <span class="examples-gallery-title-artist">{artist}</span>}
                </span>
              </a>
            )
          })}
        </div>
      </section>
    )
  }

  ExamplesGallery.afterDOMLoaded = `
function setupExamplesGalleryFilter() {
  const roots = document.querySelectorAll(".examples-gallery-root")
  for (const root of roots) {
    const filter = root.querySelector(".examples-gallery-filter")
    const cards = root.querySelectorAll(".examples-gallery-card")
    if (!filter) continue

    const updateVisibility = () => {
      const selected = filter.value
      for (const card of cards) {
        const tags = (card.getAttribute("data-tags") || "")
          .split("|")
          .filter((tag) => tag.length > 0)
        const visible = selected === "all" || tags.includes(selected)
        card.classList.toggle("is-hidden", !visible)
      }
    }

    filter.addEventListener("change", updateVisibility)
    updateVisibility()
  }
}

document.addEventListener("nav", setupExamplesGalleryFilter)
setupExamplesGalleryFilter()
`

  ExamplesGallery.css = `
.examples-gallery-controls {
  margin-bottom: 1rem;
}

.examples-gallery-controls label {
  color: var(--darkgray);
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.examples-gallery-filter {
  border: 1px solid var(--lightgray);
  border-radius: 6px;
  background: var(--light);
  color: var(--darkgray);
  padding: 0.25rem 0.45rem;
}

.examples-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 1rem;
  align-items: start;
}

.examples-gallery-card {
  display: block;
  line-height: 0;
  border-radius: 8px;
  overflow: hidden;
  position: relative;
}

.examples-gallery-card img {
  width: 100%;
  height: 180px;
  object-fit: cover;
  display: block;
}

.examples-gallery-title {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 0.55rem 0.65rem;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.78));
  color: #fff;
  font-size: 0.85rem;
  line-height: 1.25;
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  pointer-events: none;
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

.examples-gallery-title-main {
  font-weight: 600;
}

.examples-gallery-title-artist {
  opacity: 0.92;
  font-size: 0.78rem;
}

.examples-gallery-card:hover .examples-gallery-title,
.examples-gallery-card:focus-visible .examples-gallery-title {
  opacity: 1;
  transform: translateY(0);
}

.examples-gallery-card.is-hidden {
  display: none;
}
`

  return ExamplesGallery
}) satisfies QuartzComponentConstructor