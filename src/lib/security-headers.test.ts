import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { SECURITY_HEADERS } from "./security-headers";

const header = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

describe("security headers", () => {
  it("are applied to every route", async () => {
    const rules = await nextConfig.headers!();
    expect(rules).toEqual([{ source: "/(.*)", headers: SECURITY_HEADERS }]);
  });

  it("forbid framing, twice over", () => {
    expect(header("X-Frame-Options")).toBe("DENY");
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'none'");
  });

  it("is only frame-ancestors: no script, connect, img or font policy (those need care first)", () => {
    expect(header("Content-Security-Policy")).not.toMatch(/script-src|default-src|connect-src|img-src|font-src|style-src/);
  });

  it("stop sniffing, trim the referrer, switch off camera, microphone and geolocation", () => {
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(header("Permissions-Policy")).toBe("camera=(), microphone=(), geolocation=()");
  });

  it("require HTTPS for a year without binding subdomains", () => {
    expect(header("Strict-Transport-Security")).toBe("max-age=31536000");
  });

  it("don't switch off anything the app uses (sound, clipboard paste, fullscreen, WebGL)", () => {
    const policy = header("Permissions-Policy")!;
    for (const feature of ["autoplay", "clipboard-read", "clipboard-write", "fullscreen", "web-share"]) {
      expect(policy).not.toContain(feature);
    }
  });

  it("have no duplicate headers", () => {
    const keys = SECURITY_HEADERS.map((h) => h.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
