import { describe, expect, it } from "vitest";
import { byNumber, findLink, parseSpotifyEpisodes, parseYoutubeFeed, parseYtDlpList, planLinks, titleKey, titleNumber } from "./podcast-links";

const yt = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const sp = (id: string) => `https://open.spotify.com/episode/${id}`;

describe("titleNumber", () => {
  it("reads the number at the start of a title only", () => {
    expect(titleNumber("#93 AI in Banking: Will It Expose Weak Digital Strategies?")).toBe(93);
    expect(titleNumber(" #2 Banking & Fintech UX")).toBe(2);
    expect(titleNumber("UXDA Team Day | Slow Down & Reconnect")).toBeNull();
    expect(titleNumber("Recap of #12")).toBeNull();
  });
});

describe("parseYtDlpList", () => {
  it("reads id<TAB>title lines and skips blanks and junk", () => {
    const tsv = "dwopD7vNhCs\t#2 Banking & Fintech UX Strategy\n\nnot a line\n9xqZs69rZ5c\tUXDA Team Day\n";
    expect(parseYtDlpList(tsv)).toEqual([
      { number: 2, title: "#2 Banking & Fintech UX Strategy", url: yt("dwopD7vNhCs") },
      { number: null, title: "UXDA Team Day", url: yt("9xqZs69rZ5c") },
    ]);
  });
});

describe("parseYoutubeFeed", () => {
  it("reads the channel feed's entries, not the channel's own title", () => {
    const xml = `<feed><title>UXDA | Financial UX Design</title>
<entry><yt:videoId>abcDEF12345</yt:videoId><title>#93 AI in Banking</title></entry>
<entry><yt:videoId>ghiJKL67890</yt:videoId><title>#91 Scaling Banking UX: Adoption &amp; ROI</title></entry></feed>`;
    expect(parseYoutubeFeed(xml)).toEqual([
      { number: 93, title: "#93 AI in Banking", url: yt("abcDEF12345") },
      { number: 91, title: "#91 Scaling Banking UX: Adoption & ROI", url: yt("ghiJKL67890") },
    ]);
  });
});

describe("parseSpotifyEpisodes", () => {
  it("reads a page of episodes, skipping nulls and broken items", () => {
    const page = { items: [{ id: "4rOoJ6Egrf8K2IrywzwOMk", name: "#93 AI in Banking" }, null, { id: 5, name: "x" }], next: null };
    expect(parseSpotifyEpisodes(page)).toEqual([{ number: 93, title: "#93 AI in Banking", url: sp("4rOoJ6Egrf8K2IrywzwOMk") }]);
    expect(parseSpotifyEpisodes(null)).toEqual([]);
  });
});

describe("byNumber", () => {
  it("links each number once and leaves out a number found twice", () => {
    const { links, byTitle, notes } = byNumber(
      [
        { number: 1, title: "#1 A", url: yt("aaaaaaa") },
        { number: 2, title: "#2 B", url: yt("bbbbbbb") },
        { number: 2, title: "#2 B (re-upload)", url: yt("ccccccc") },
        { number: 3, title: "#3 C", url: yt("ddddddd") },
        { number: 3, title: "#3 C", url: yt("ddddddd") },
        { number: null, title: "Trailer", url: yt("eeeeeee") },
        { number: null, title: "Team Day", url: yt("fffffff") },
        { number: null, title: "Team Day", url: yt("ggggggg") },
      ],
      "YouTube",
    );
    expect([...byTitle]).toEqual([["trailer", yt("eeeeeee")]]);
    expect([...links]).toEqual([
      [1, yt("aaaaaaa")],
      [3, yt("ddddddd")],
    ]);
    expect(notes).toEqual(["#2 is on YouTube 2 times (#2 B / #2 B (re-upload)): not linked"]);
  });
});

describe("titleKey", () => {
  it("drops the number, case and punctuation", () => {
    expect(titleKey("#60 AI: From Automation to Intelligence")).toBe(titleKey("AI — from automation to intelligence"));
    expect(titleKey("#60 AI: From Automation to Intelligence")).toBe("ai from automation to intelligence");
  });
});

describe("findLink", () => {
  const index = { links: new Map([[93, yt("ninety3")]]), byTitle: new Map([["ai from automation to intelligence", yt("sixty60")]]) };
  it("uses the stored number, else the number in the title, else the exact title", () => {
    expect(findLink(index, { title: "anything", number: 93 })).toBe(yt("ninety3"));
    expect(findLink(index, { title: "#93 AI in Banking", number: null })).toBe(yt("ninety3"));
    expect(findLink(index, { title: "#60 AI: From Automation to Intelligence", number: 60 })).toBe(yt("sixty60"));
    expect(findLink(index, { title: "UXDA Anthem", number: null })).toBeUndefined();
  });
});

describe("planLinks", () => {
  const spotify = {
    links: new Map([
      [1, sp("one")],
      [2, sp("two")],
    ]),
    byTitle: new Map<string, string>(),
    notes: [],
  };
  const youtube = {
    links: new Map([
      [1, yt("one1111")],
      [3, yt("three33")],
    ]),
    byTitle: new Map<string, string>(),
    notes: [],
  };

  it("fills only empty links, and names a link that differs instead of replacing it", () => {
    const rows = [
      { id: "a", title: "#1", number: 1, spotify_url: null, youtube_url: null },
      { id: "b", title: "#2", number: 2, spotify_url: sp("other"), youtube_url: null },
      { id: "c", title: "#3", number: 3, spotify_url: null, youtube_url: yt("three33") },
      { id: "d", title: "Anthem", number: null, spotify_url: null, youtube_url: null },
      { id: "e", title: "#4", number: 4, spotify_url: null, youtube_url: null },
    ];
    const { changes, notes } = planLinks(rows, spotify, youtube);
    expect(changes).toEqual([{ id: "a", title: "#1", spotify_url: sp("one"), youtube_url: yt("one1111") }]);
    expect(notes).toEqual([`#2: keeps its spotify_url ${sp("other")} (found ${sp("two")})`]);
  });
});
