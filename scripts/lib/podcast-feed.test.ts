import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { episodeBlurb, matchEpisodes, normUrl, parseFeed, titleSimilarity } = await import("./podcast-feed");

// Two items shaped like the Buzzsprout feed (trimmed).
const FEED = `<rss><channel><title>UXDA | Financial UX Design Podcast</title>
<item>
  <itunes:title>#91 Scaling Banking UX: Adoption &amp; ROI</itunes:title>
  <title>#91 Scaling Banking UX: Adoption &amp; ROI</title>
  <description><![CDATA[<p>A successful banking redesign is not the finish line.<br/><br/>This episode explores why banks struggle to scale.<br/><br/><b>Find out:</b></p><ul><li>Why one-off redesigns fail</li></ul><p><b>Read the full article on UXDA’s blog:</b><a href='https://theuxda.com/blog/financial-ux-governance'>https://theuxda.com/blog/financial-ux-governance</a></p>]]></description>
  <enclosure url="https://www.buzzsprout.com/942295/episodes/19933806-91-scaling-banking-ux.mp3" length="1" type="audio/mpeg" />
  <itunes:image href="https://storage.buzzsprout.com/abc?.jpg" />
  <itunes:episode>91</itunes:episode>
</item>
<item>
  <title>#7 UX Trends</title>
  <link>https://www.theuxda.com/</link>
  <description><![CDATA[<p>Trends.</p>]]></description>
  <enclosure url="https://www.buzzsprout.com/942295/episodes/7-ux-trends.mp3" length="1" type="audio/mpeg" />
</item>
</channel></rss>`;

describe("parseFeed", () => {
  it("reads number, title, page, picture, blog link and opening text", () => {
    expect(parseFeed(FEED)).toEqual([
      {
        number: 91,
        title: "#91 Scaling Banking UX: Adoption & ROI",
        pageUrl: "https://www.buzzsprout.com/942295/episodes/19933806-91-scaling-banking-ux",
        imageUrl: "https://storage.buzzsprout.com/abc?.jpg",
        blogUrl: "https://theuxda.com/blog/financial-ux-governance",
        blurb: "A successful banking redesign is not the finish line. This episode explores why banks struggle to scale.",
      },
      // No <itunes:episode>: the number comes from the title; the site's home page isn't a blog link.
      expect.objectContaining({ number: 7, blogUrl: null, imageUrl: null, blurb: "Trends." }),
    ]);
  });

  it("cuts a long opening at a sentence end", () => {
    const long = `<p>${"Banks need better experiences for everyone. ".repeat(15)}</p>`;
    const blurb = episodeBlurb(long)!;
    expect(blurb.length).toBeLessThanOrEqual(400);
    expect(blurb.endsWith(".")).toBe(true);
  });
});

describe("matchEpisodes", () => {
  const ep = (number: number, title: string, blogUrl: string | null = null) => ({ number, title, pageUrl: `https://bz/${number}`, imageUrl: null, blogUrl, blurb: null });
  const blogs = [
    { id: "gov", url: "https://www.theuxda.com/blog/financial-ux-governance/", title: "Financial UX Governance", sheetEpisode: "91" },
    { id: "trends", url: "https://theuxda.com/blog/ux-trends", title: "Top UX Trends in Digital Banking", sheetEpisode: "7" },
    { id: "ai", url: "https://theuxda.com/blog/ai-banking", title: "AI in Banking: Preventing Bad UX", sheetEpisode: "v" },
    { id: "audit", url: "https://theuxda.com/blog/ux-audit", title: "The Power of UX Audit in Banking", sheetEpisode: null },
  ];

  it("pairs by link, then by the sheet's number, then by a clearly similar title", () => {
    const { matches } = matchEpisodes(
      [ep(91, "#91 Scaling Banking UX", "https://theuxda.com/blog/financial-ux-governance"), ep(7, "#7 UX Trends"), ep(92, "#92 AI in Banking: Preventing Bad UX")],
      blogs,
    );
    expect(matches.map((m) => [m.episode.number, m.blogId, m.how])).toEqual([
      [7, "trends", "number"],
      [91, "gov", "link"],
      [92, "ai", "title"],
    ]);
  });

  it("leaves doubtful ones on their own and says why", () => {
    const { matches, notes } = matchEpisodes(
      [ep(7, "#7 UX Trends"), ep(8, "#8 More UX Trends", "https://theuxda.com/blog/ux-trends"), ep(50, "#50 Audit Banking Apps"), ep(60, "#60 Something Else", "https://theuxda.com/blog/gone")],
      blogs,
    );
    expect(matches.filter((m) => m.blogId).map((m) => m.episode.number)).toEqual([7]);
    expect(notes).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/#8 and #7 both belong to "Top UX Trends/),
        expect.stringMatching(/#50 .* might be "The Power of UX Audit in Banking"/),
        expect.stringMatching(/#60 links to https:\/\/theuxda.com\/blog\/gone, which isn't in the Academy/),
        expect.stringMatching(/"Financial UX Governance" has episode #91 in the sheet/),
      ]),
    );
  });

  it("normalises links and compares titles without stop words", () => {
    expect(normUrl("https://www.theuxda.com/blog/a/?utm=x")).toBe(normUrl("http://theuxda.com/blog/a"));
    expect(titleSimilarity("#92 AI in Banking: Preventing Bad UX", "AI in Banking — Preventing Bad UX")).toBe(1);
    expect(titleSimilarity("UX Trends", "Banking Audit")).toBe(0);
  });
});

describe("matchEpisodes: re-recordings", () => {
  const ep = (number: number, blogUrl: string) => ({ number, title: `#${number} Episode`, pageUrl: `https://bz/${number}`, imageUrl: null, blogUrl, blurb: null });
  const blog = { id: "pyr", url: "https://theuxda.com/blog/value-pyramid", title: "Value Pyramid", sheetEpisode: "24" };

  it("gives the post to the episode the sheet names by number, else to the older one", () => {
    const named = matchEpisodes([ep(2, blog.url), ep(24, blog.url)], [blog]).matches;
    expect(named.map((m) => [m.episode.number, m.blogId])).toEqual([[2, null], [24, "pyr"]]);
    const unnamed = matchEpisodes([ep(24, blog.url), ep(2, blog.url)], [{ ...blog, sheetEpisode: null }]).matches;
    expect(unnamed.map((m) => [m.episode.number, m.blogId])).toEqual([[2, "pyr"], [24, null]]);
  });
});
