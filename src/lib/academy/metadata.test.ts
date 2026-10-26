import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { cleanBlurb, cleanTitle, decodeEntities, extractText, isPrivateAddress, isbnFromUrl, parseLinkPreview, safeFetch, sniffImageType } = await import("./metadata");

// The head of a theuxda.com blog post, trimmed (the tags the preview reads).
const BLOG_HEAD = `<!doctype html><html><head>
<title>Bank-as-a-Product • UXDA</title>
<meta name="description" content="Discover why a best-in-class mobile app isn&rsquo;t enough.">
<meta property="og:title" content="Bank-as-a-Product: Mobile Banking App Redesign is Not Enough • UXDA | Financial UX Design">
<meta property="og:description" content="Discover why a best-in-class mobile app isn’t enough to deliver great banking UX &amp; more.">
<meta property="og:image" content="/storage/app/media/blog/hero.png">
</head><body><nav>Menu Blog Contact</nav><article><h1>Bank-as-a-Product</h1><p>First idea.</p><script>var x=1</script><p>Second &amp; last.</p></article><footer>© UXDA</footer></body></html>`;

describe("parseLinkPreview", () => {
  it("reads Open Graph title, description and picture, resolving a relative picture URL", () => {
    expect(parseLinkPreview(BLOG_HEAD, "https://theuxda.com/blog/banking-ux-beyond-mobile-app")).toEqual({
      title: "Bank-as-a-Product: Mobile Banking App Redesign is Not Enough",
      description: "Discover why a best-in-class mobile app isn’t enough to deliver great banking UX & more.",
      imageUrl: "https://theuxda.com/storage/app/media/blog/hero.png",
    });
  });

  it("falls back to <title> and the plain description, and ignores a non-http picture", () => {
    const html = `<title> Plain &amp; simple </title><meta content="Just a page" name="description"><meta property="og:image" content="javascript:alert(1)">`;
    expect(parseLinkPreview(html, "https://example.com/")).toEqual({ title: "Plain & simple", description: "Just a page", imageUrl: null });
  });

  it("returns nulls for a page without any", () => {
    expect(parseLinkPreview("<html></html>", "https://example.com/")).toEqual({ title: null, description: null, imageUrl: null });
  });
});

describe("cleanTitle", () => {
  it("drops a suffix that names the site, and leaves other titles alone", () => {
    expect(cleanTitle("Post • UXDA | Financial UX Design", "https://theuxda.com/blog/x")).toBe("Post");
    expect(cleanTitle("Episode 12 | The UXDA Podcast", "https://podcasts.theuxda.com/12")).toBe("Episode 12");
    expect(cleanTitle("Design | Research | Delivery", "https://example.com/")).toBe("Design | Research | Delivery");
    expect(cleanTitle("Banking-as-a-Service – what it means", "https://theuxda.com/")).toBe("Banking-as-a-Service – what it means");
  });
});

describe("extractText", () => {
  it("keeps the article's text without nav, scripts or footer", () => {
    const text = extractText(BLOG_HEAD);
    expect(text).toContain("First idea.");
    expect(text).toContain("Second & last.");
    expect(text).not.toMatch(/Menu|var x|© UXDA/);
  });
});

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "224.0.0.1", "::1", "::", "fd00::1", "fe80::1", "::ffff:127.0.0.1", "nonsense"])(
    "refuses %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );
  it.each(["8.8.8.8", "172.32.0.1", "104.21.3.4", "2606:4700::6810:84e5"])("allows %s", (ip) => expect(isPrivateAddress(ip)).toBe(false));
});

describe("safeFetch", () => {
  it("refuses non-http links and private hosts without fetching", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(safeFetch("file:///etc/passwd", "*/*")).rejects.toThrow(/http/);
    await expect(safeFetch("http://127.0.0.1:5432/", "*/*")).rejects.toThrow(/can't read/);
    await expect(safeFetch("http://[::1]/", "*/*")).rejects.toThrow(/can't read/);
    await expect(safeFetch("https://user:pw@example.com/", "*/*")).rejects.toThrow(/password/);
    await expect(safeFetch("not a url", "*/*")).rejects.toThrow(/link/);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("checks every redirect hop", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest" } }));
    await expect(safeFetch("https://93.184.215.14/", "*/*")).rejects.toThrow(/can't read/);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    fetchSpy.mockRestore();
  });
});

describe("helpers", () => {
  it("finds an ISBN in Amazon links", () => {
    expect(isbnFromUrl("https://www.amazon.com/Design-Future-Things-Don-Norman/dp/0465002285/ref=sr_1_1")).toBe("0465002285");
    expect(isbnFromUrl("https://www.amazon.fr/gp/product/150113202X?x=1")).toBe("150113202X");
    expect(isbnFromUrl("https://drive.google.com/file/d/abc/view")).toBeNull();
  });

  it("recognises pictures by their bytes", () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
    expect(sniffImageType(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
  });

  it("cleans Open Library blurbs and decodes entities", () => {
    expect(cleanBlurb("A classic book. ([source][1])\n\n----------\n[1]: https://example.com")).toBe("A classic book.");
    expect(decodeEntities("A &amp; B &#8217; &#x2014; &bogus;")).toBe("A & B ’ — &bogus;");
  });
});
