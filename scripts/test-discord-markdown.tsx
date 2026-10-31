import { renderToStaticMarkup } from 'react-dom/server'

import { MessageBody } from '../src/blocks/components/Discord/markdown'

/**
 * Parser checks for the Discord Quote block's markdown, rendered through the
 * real component so the shipped code is what gets exercised:
 *
 *   pnpm test:discord
 *
 * Covers the mark precedence rules, the two guards that keep file names and
 * stray asterisks from being read as emphasis, and — the ones that matter —
 * that pasted HTML is escaped and only http(s) URLs ever become links.
 */

const CASES: Array<{ expect: RegExp[]; name: string; reject?: RegExp[]; source: string }> = [
  {
    name: 'bold beats italic',
    source: '**four coins**',
    expect: [/<strong[^>]*>four coins<\/strong>/],
    reject: [/<em/],
  },
  {
    name: 'nested marks',
    source: '**bold with *italic* inside**',
    expect: [/<strong[^>]*>bold with <em[^>]*>italic<\/em> inside<\/strong>/],
  },
  {
    name: 'code suppresses inner marks',
    source: 'run `npm **install**` first',
    expect: [/<code[^>]*>npm \*\*install\*\*<\/code>/],
    reject: [/<strong/],
  },
  {
    name: 'underscores inside a word are left alone',
    source: 'the file vale_gate_notice.png and _real italics_',
    expect: [/vale_gate_notice\.png/, /<em[^>]*>real italics<\/em>/],
  },
  {
    name: 'double underscore underlines, but not in snake_case__names',
    source: '__underlined__ but snake_case__names stay',
    expect: [/<span class="underline[^"]*">underlined<\/span>/, /snake_case__names/],
  },
  {
    name: 'autolink drops the sentence full stop',
    source: 'see https://nation-of-azania.com/gov/about. Thanks',
    expect: [/href="https:\/\/nation-of-azania\.com\/gov\/about"/, /<\/a>\. Thanks/],
  },
  {
    name: 'markdown link',
    source: '[the register](https://nation-of-azania.com/gov) has it',
    expect: [/<a class="[^"]*" href="https:\/\/nation-of-azania\.com\/gov"[^>]*>the register<\/a>/],
  },
  {
    name: 'javascript: urls are not linkified',
    source: 'javascript:alert(1) and [x](javascript:alert(1))',
    expect: [/javascript:alert\(1\)/],
    reject: [/<a /],
  },
  {
    name: 'html in a message is escaped, never injected',
    source: '<img src=x onerror="alert(1)"> & <b>hi</b>',
    expect: [/&lt;img src=x onerror=/, /&amp; &lt;b&gt;hi&lt;\/b&gt;/],
    reject: [/<img/, /<b>/],
  },
  {
    name: 'line quote, then normal text',
    source: '> quoted line\nback to normal',
    expect: [/<blockquote[^>]*>quoted line<\/blockquote>/, /back to normal/],
  },
  {
    name: 'consecutive quote lines merge into one block',
    source: '> one\n> two\nafter',
    expect: [/<blockquote[^>]*>one\ntwo<\/blockquote>/],
  },
  {
    name: '>>> quotes the remainder',
    source: 'intro\n>>> everything\nafter this\nis quoted',
    expect: [/<blockquote[^>]*>everything\nafter this\nis quoted<\/blockquote>/],
  },
  {
    name: 'fenced code block with a language',
    source: 'look:\n```js\nconst a = **1**\n```\ndone',
    expect: [/<pre[^>]*><code class="font-mono">const a = \*\*1\*\*<\/code><\/pre>/, /done/],
    reject: [/<strong/],
  },
  {
    name: 'mentions and channels',
    source: '@Keeper posted in #town-hall',
    expect: [/<span class="[^"]*text-dc-mention[^"]*">@Keeper<\/span>/, /#town-hall/],
  },
  {
    name: 'spoiler renders as a button',
    source: 'the answer is ||four||',
    expect: [/<button[^>]*aria-label="Spoiler, click to reveal"[^>]*>four<\/button>/],
  },
  {
    name: 'strikethrough',
    source: '~~two~~ four',
    expect: [/<s[^>]*>two<\/s>/],
  },
  {
    name: 'unmatched delimiters stay literal',
    source: 'a ** b * c ~~ d || e',
    expect: [/a \*\* b \* c ~~ d \|\| e/],
    reject: [/<strong/, /<em/, /<s /, /<button/],
  },
  {
    name: 'emphasis must hug its text',
    source: 'rated * out of * five and ** not bold **',
    expect: [/rated \* out of \* five and \*\* not bold \*\*/],
    reject: [/<em/, /<strong/],
  },
  {
    name: 'emoji and newlines survive',
    source: 'line one 🙂\nline two',
    expect: [/line one <span[^>]*data-emoji="inline"[^>]*>🙂<\/span>\nline two/],
  },
  {
    name: 'a message of only emoji is jumbo, as Discord shows it',
    source: '💔',
    expect: [/data-emoji="jumbo"[^>]*>💔</],
    reject: [/data-emoji="inline"/],
  },
  {
    name: 'several emoji with spaces, a joined family and a flag are jumbo too',
    source: '😭 👨‍👩‍👧 🇩🇪 1️⃣ ❤️',
    expect: [/>😭</, />👨‍👩‍👧</, />🇩🇪</, />1️⃣</, />❤️</],
    reject: [/data-emoji="inline"/],
  },
  {
    name: 'emoji beside words stay inline',
    source: 'so sad 💔',
    expect: [/so sad <span[^>]*data-emoji="inline"[^>]*>💔<\/span>/],
    reject: [/data-emoji="jumbo"/],
  },
  {
    name: 'thirty-one emoji are too many to be jumbo',
    source: '🙂'.repeat(31),
    expect: [/data-emoji="inline"/],
    reject: [/data-emoji="jumbo"/],
  },
  {
    name: 'digits, and a pictograph asked to show as text, are not emoji',
    source: '123 ☺\uFE0E',
    reject: [/data-emoji/],
    expect: [/123 ☺/],
  },
  {
    name: 'emoji in code keep the text as typed',
    source: '`💔`',
    expect: [/<code[^>]*>💔<\/code>/],
    reject: [/data-emoji/],
  },
]

let failed = 0

for (const testCase of CASES) {
  const html = renderToStaticMarkup(<MessageBody body={testCase.source} />)
  const problems: string[] = []

  for (const pattern of testCase.expect) {
    if (!pattern.test(html)) problems.push(`missing ${pattern}`)
  }
  for (const pattern of testCase.reject ?? []) {
    if (pattern.test(html)) problems.push(`unexpected ${pattern}`)
  }

  if (problems.length === 0) {
    console.log(`  ok    ${testCase.name}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${testCase.name}`)
    for (const problem of problems) console.log(`          ${problem}`)
    console.log(`          got: ${html}`)
  }
}

console.log(failed === 0 ? `\n  ${CASES.length} passed\n` : `\n  ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
