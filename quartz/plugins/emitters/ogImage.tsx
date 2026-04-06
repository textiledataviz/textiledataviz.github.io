import { QuartzEmitterPlugin } from "../types"
import { i18n } from "../../i18n"
import { unescapeHTML } from "../../util/escape"
import { FullSlug, getFileExtension, isAbsoluteURL } from "../../util/path"
import path from "path"
import { ImageOptions, SocialImageOptions, defaultImage, getSatoriFonts } from "../../util/og"
import sharp from "sharp"
import satori, { SatoriOptions } from "satori"
import { loadEmoji, getIconCode } from "../../util/emoji"
import { Readable } from "stream"
import { write } from "./helpers"
import { BuildCtx } from "../../util/ctx"
import { QuartzPluginData } from "../vfile"
import fs from "node:fs/promises"
import { styleText } from "util"
import { glob } from "../../util/glob"

const defaultOptions: SocialImageOptions = {
  colorScheme: "darkMode",
  width: 1200,
  height: 630,
  imageStructure: defaultImage,
  excludeRoot: false,
}

/**
 * Generates social image (OG/twitter standard) and saves it as `.webp` inside the public folder
 * @param opts options for generating image
 */
async function generateSocialImage(
  { cfg, description, fonts, title, fileData, contentImageBase64 }: ImageOptions,
  userOpts: SocialImageOptions,
): Promise<Readable> {
  const { width, height } = userOpts
  const iconPath = "noun-weave.png"
  let iconBase64: string | undefined = undefined
  try {
    const iconData = await fs.readFile(iconPath)
    iconBase64 = `data:image/png;base64,${iconData.toString("base64")}`
  } catch (err) {
    console.warn(styleText("yellow", `Warning: Could not find icon at ${iconPath}`))
  }

  const imageComponent = userOpts.imageStructure({
    cfg,
    userOpts,
    title,
    description,
    fonts,
    fileData,
    iconBase64,
    contentImageBase64,
  })

  const svg = await satori(imageComponent, {
    width,
    height,
    fonts,
    loadAdditionalAsset: async (languageCode: string, segment: string) => {
      if (languageCode === "emoji") {
        return await loadEmoji(getIconCode(segment))
      }

      return languageCode
    },
  })

  return sharp(Buffer.from(svg)).webp({ quality: 40 })
}

async function processOgImage(
  ctx: BuildCtx,
  fileData: QuartzPluginData,
  fonts: SatoriOptions["fonts"],
  fullOptions: SocialImageOptions,
) {
  const cfg = ctx.cfg.configuration
  const slug = fileData.slug!
  const titleSuffix = cfg.pageTitleSuffix ?? ""
  const title =
    (fileData.frontmatter?.title ?? i18n(cfg.locale).propertyDefaults.title) + titleSuffix
  const contentDescription = unescapeHTML(fileData.description?.trim() ?? "")
  const description =
    fileData.frontmatter?.socialDescription ??
    // Prefer description generated from current page content over frontmatter description.
    (contentDescription.length > 0 ? contentDescription : undefined) ??
    fileData.frontmatter?.description ??
    i18n(cfg.locale).propertyDefaults.description

  // Extract first image from the first 3 paragraphs of the page
  let contentImageBase64: string | undefined = undefined
  if (fileData.filePath && fileData.text) {
    const paragraphs = fileData.text.split(/\n\n+/).slice(0, 3)
    const imageMatch = paragraphs.join("\n\n").match(/!\[[^\]]*\]\(([^)]+)\)/)
    if (imageMatch) {
      const imageSrc = imageMatch[1]
      try {
        if (imageSrc.startsWith("http://") || imageSrc.startsWith("https://")) {
          const resp = await fetch(imageSrc)
          if (resp.ok) {
            const buf = Buffer.from(await resp.arrayBuffer())
            const ext = (imageSrc.split(".").pop()?.split("?")[0] ?? "jpeg").toLowerCase()
            const mime = ext === "jpg" ? "jpeg" : ext
            contentImageBase64 = `data:image/${mime};base64,${buf.toString("base64")}`
          }
        } else {
          // First try path relative to the source file's directory
          let imgPath = path.join(path.dirname(fileData.filePath), imageSrc)
          try {
            await fs.access(imgPath)
          } catch {
            // Fall back to shortest-path resolution: search recursively under content root
            const filename = path.basename(imageSrc)
            const matches = await glob(`**/${filename}`, ctx.argv.directory, [])
            imgPath = matches.length > 0 ? path.join(ctx.argv.directory, matches[0]) : imgPath
          }
          const imgData = await fs.readFile(imgPath)
          const ext = path.extname(imageSrc).slice(1).toLowerCase() || "jpeg"
          const mime = ext === "jpg" ? "jpeg" : ext
          contentImageBase64 = `data:image/${mime};base64,${imgData.toString("base64")}`
        }
      } catch {
        // image not found or failed to load, skip
      }
    }
  }

  const stream = await generateSocialImage(
    {
      title,
      description,
      fonts,
      cfg,
      fileData,
      contentImageBase64,
    },
    fullOptions,
  )

  return write({
    ctx,
    content: stream,
    slug: `${slug}-og-image` as FullSlug,
    ext: ".webp",
  })
}

export const CustomOgImagesEmitterName = "CustomOgImages"
export const CustomOgImages: QuartzEmitterPlugin<Partial<SocialImageOptions>> = (userOpts) => {
  const fullOptions = { ...defaultOptions, ...userOpts }

  return {
    name: CustomOgImagesEmitterName,
    getQuartzComponents() {
      return []
    },
    async *emit(ctx, content, _resources) {
      const cfg = ctx.cfg.configuration
      const headerFont = cfg.theme.typography.header
      const bodyFont = cfg.theme.typography.body
      const fonts = await getSatoriFonts(headerFont, bodyFont)

      for (const [_tree, vfile] of content) {
        if (vfile.data.frontmatter?.socialImage !== undefined) continue
        yield processOgImage(ctx, vfile.data, fonts, fullOptions)
      }
    },
    async *partialEmit(ctx, _content, _resources, changeEvents) {
      const cfg = ctx.cfg.configuration
      const headerFont = cfg.theme.typography.header
      const bodyFont = cfg.theme.typography.body
      const fonts = await getSatoriFonts(headerFont, bodyFont)

      // find all slugs that changed or were added
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue
        if (changeEvent.file.data.frontmatter?.socialImage !== undefined) continue
        if (changeEvent.type === "add" || changeEvent.type === "change") {
          yield processOgImage(ctx, changeEvent.file.data, fonts, fullOptions)
        }
      }
    },
    externalResources: (ctx) => {
      if (!ctx.cfg.configuration.baseUrl) {
        return {}
      }

      const baseUrl = ctx.cfg.configuration.baseUrl
      return {
        additionalHead: [
          (pageData) => {
            const isRealFile = pageData.filePath !== undefined
            let userDefinedOgImagePath = pageData.frontmatter?.socialImage

            if (userDefinedOgImagePath) {
              userDefinedOgImagePath = isAbsoluteURL(userDefinedOgImagePath)
                ? userDefinedOgImagePath
                : `https://${baseUrl}/static/${userDefinedOgImagePath}`
            }

            const generatedOgImagePath = isRealFile
              ? `https://${baseUrl}/${pageData.slug!}-og-image.webp`
              : undefined
            const defaultOgImagePath = `https://${baseUrl}/static/noun-weave.png`
            const ogImagePath = userDefinedOgImagePath ?? generatedOgImagePath ?? defaultOgImagePath
            const ogImageMimeType = `image/${getFileExtension(ogImagePath) ?? "png"}`
            return (
              <>
                {!userDefinedOgImagePath && (
                  <>
                    <meta property="og:image:width" content={fullOptions.width.toString()} />
                    <meta property="og:image:height" content={fullOptions.height.toString()} />
                  </>
                )}

                <meta property="og:image" content={ogImagePath} />
                <meta property="og:image:url" content={ogImagePath} />
                <meta name="twitter:image" content={ogImagePath} />
                <meta property="og:image:type" content={ogImageMimeType} />
              </>
            )
          },
        ],
      }
    },
  }
}
