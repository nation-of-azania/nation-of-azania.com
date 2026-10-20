<?xml version="1.0" encoding="UTF-8"?>
<!--
  How a feed looks in a browser. A feed reader ignores this; a browser
  that lands on /gov/feed.xml renders the feed through it as a page that
  says what a feed is and how to subscribe, then lists what the feed
  carries, dressed in the paper's own colours and face: the channel says
  which design it wears (azania:design) and which style (azania:style),
  and the body takes them as classes. Browsers without XSLT show the raw
  XML, as they would anyway. Kept to one file with no scripts.
-->
<xsl:stylesheet
  version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:azania="urn:azania:feed"
  exclude-result-prefixes="atom dc azania"
>
  <xsl:output method="html" encoding="UTF-8" indent="yes" doctype-system="about:legacy-compat" />

  <xsl:template match="/rss/channel">
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title><xsl:value-of select="title" /> · RSS feed</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Alegreya:ital@0;1&amp;family=Archivo:wght@700;900&amp;family=Fredoka:wght@500;600&amp;family=IBM+Plex+Mono&amp;family=IBM+Plex+Serif:wght@500&amp;family=Source+Sans+3:wght@400;600&amp;display=swap"
        />
        <style>
          :root {
            /* The Gazette's dress: the site's base, as in src/app/(frontend)/globals.css. */
            --ground: #fbf8f1; --panel: #f5efe2; --line: #d6c9ab; --ink: #16191f; --muted: #555c6a;
            --head: #0a1b2a; --accent: #96600f; --rule: #d8962c; --link: #1a4461; --bar: #14334b; --bar-text: #f5efe2;
            --display: 'Alegreya', Georgia, 'Times New Roman', serif; --display-weight: 400;
            --label: 'Source Sans 3', system-ui, sans-serif; --body: 'Source Sans 3', system-ui, sans-serif;
            --transform: none;
          }
          .design-times {
            --ground: #faf9f6; --panel: #f2f0eb; --line: #e3dfd6; --ink: #141311; --muted: #6b6862;
            --head: #141311; --accent: #962c17; --rule: #198a98; --link: #962c17; --bar: #772012; --bar-text: #faf9f6;
            --display: 'Archivo', 'Helvetica Neue', Arial, sans-serif; --display-weight: 900; --transform: uppercase;
          }
          .design-international {
            --ground: #f8f8f5; --panel: #f1f1ed; --line: #e4e4de; --ink: #1b1e22; --muted: #5c636d;
            --head: #1b1e22; --accent: #4a5566; --rule: #2b5f57; --link: #2b5f57; --bar: #f1f1ed; --bar-text: #5c636d;
            --display: 'IBM Plex Serif', Georgia, serif; --display-weight: 500;
            --label: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
          }
          /* Cherry Blossom (GirlieTown): rose in the accent's places, the bubbly face for headlines and labels. */
          .style-blossom {
            --panel: #fbe7ee; --line: #f2b4cb; --accent: #9b2f5e; --rule: #e58fb3; --link: #9b2f5e;
            --display: 'Fredoka', 'Arial Rounded MT Bold', system-ui, sans-serif; --display-weight: 600;
            --label: 'Fredoka', system-ui, sans-serif; --transform: none;
          }
          .style-blossom.design-times { --head: #5a1a3a; --bar: #7d2353; --bar-text: #fbe7ee; }

          * { box-sizing: border-box; }
          html { background: var(--ground); color: var(--ink); }
          body { margin: 0; font: 17px/1.55 var(--body); -webkit-font-smoothing: antialiased; }
          a { color: var(--link); }
          .wrap { max-width: 44rem; margin: 0 auto; padding: 0 1.25rem; }
          .label { font-family: var(--label); font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; }

          .strip { background: var(--bar); color: var(--bar-text); border-bottom: 3px solid var(--rule); }
          .strip .wrap { padding-top: 0.9rem; padding-bottom: 0.9rem; font-size: 14px; }
          .strip strong { font-weight: 600; }
          .strip a { color: inherit; }

          .masthead { padding: 3rem 0 2rem; border-bottom: 3px solid var(--head); }
          .masthead .label { color: var(--accent); margin: 0; }
          .masthead h1 {
            font-family: var(--display); font-weight: var(--display-weight); text-transform: var(--transform);
            color: var(--head); font-size: clamp(2rem, 6vw, 3rem); line-height: 1.05; margin: 0.6rem 0 0; letter-spacing: -0.01em;
          }
          .masthead h1 a { color: inherit; text-decoration: none; }
          .masthead p.lede { margin: 0.9rem 0 0; font-size: 1.1rem; color: var(--muted); max-width: 36rem; }
          .emblem { float: right; width: 5.5rem; height: 5.5rem; margin: 0 0 1rem 1.5rem; padding: 0.4rem;
            background: var(--panel); border: 1px solid var(--line); object-fit: contain; }

          .subscribe { margin: 1.75rem 0 0; padding: 1rem 1.25rem; background: var(--panel); border: 1px solid var(--line); }
          .subscribe .label { color: var(--accent); margin: 0 0 0.4rem; }
          .subscribe code {
            display: block; font: 15px/1.5 'IBM Plex Mono', ui-monospace, Menlo, monospace; word-break: break-all;
            user-select: all; color: var(--ink);
          }
          .subscribe p { margin: 0.6rem 0 0; font-size: 14px; color: var(--muted); }

          .items { list-style: none; margin: 0; padding: 0; }
          .items li { padding: 1.5rem 0; border-bottom: 1px solid var(--line); }
          .items .label { color: var(--accent); margin: 0; }
          .items .label time { color: var(--muted); font-weight: 400; }
          .items h2 {
            font-family: var(--display); font-weight: var(--display-weight); color: var(--head);
            font-size: 1.5rem; line-height: 1.2; margin: 0.4rem 0 0; letter-spacing: -0.01em;
          }
          .items h2 a { color: inherit; text-decoration: none; }
          .items h2 a:hover { color: var(--accent); }
          .items p { margin: 0.5rem 0 0; color: var(--ink); }
          .items .by { font-size: 14px; color: var(--muted); }

          .colophon { padding: 2rem 0 3rem; font-size: 13px; color: var(--muted); }
          .colophon .rule { height: 3px; background: var(--head); margin-bottom: 2px; }
          .colophon .hair { height: 1px; background: var(--rule); margin-bottom: 1.25rem; }
        </style>
      </head>
      <body class="design-{azania:design} style-{azania:style}">
        <div class="strip">
          <div class="wrap">
            <strong>This is a web feed</strong>, also called an RSS feed. Put its address into a
            feed reader, or a Discord RSS bot, and each new article arrives there as it is published.
          </div>
        </div>

        <main class="wrap">
          <header class="masthead">
            <xsl:if test="image/url and image/width &lt; 1000">
              <img class="emblem" src="{image/url}" alt="" />
            </xsl:if>
            <p class="label">RSS feed</p>
            <h1><a href="{link}"><xsl:value-of select="title" /></a></h1>
            <p class="lede"><xsl:value-of select="description" /></p>
            <div class="subscribe">
              <p class="label">Subscribe</p>
              <code><xsl:value-of select="atom:link[@rel='self']/@href" /></code>
              <p>
                Copy this address into your reader. <a href="{link}">Read it on the site</a> instead,
                or <a href="/feed.xml">follow everything Azania publishes</a>.
              </p>
            </div>
          </header>

          <ol class="items">
            <xsl:for-each select="item">
              <li>
                <p class="label">
                  <xsl:for-each select="category">
                    <xsl:if test="position() &gt; 1"> · </xsl:if>
                    <xsl:value-of select="." />
                  </xsl:for-each>
                  <xsl:if test="pubDate">
                    <xsl:text> · </xsl:text>
                    <time><xsl:value-of select="substring(pubDate, 6, 11)" /></time>
                  </xsl:if>
                </p>
                <h2><a href="{link}"><xsl:value-of select="title" /></a></h2>
                <xsl:if test="description">
                  <p><xsl:value-of select="description" /></p>
                </xsl:if>
                <xsl:if test="dc:creator">
                  <p class="by">By <xsl:value-of select="dc:creator" /></p>
                </xsl:if>
              </li>
            </xsl:for-each>
          </ol>

          <footer class="colophon">
            <div class="rule"></div>
            <div class="hair"></div>
            The <xsl:value-of select="count(item)" /> newest articles of
            <a href="{link}"><xsl:value-of select="title" /></a>, newest first.
            Published by the Nation of Azania on the Rulercraft realm.
          </footer>
        </main>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
