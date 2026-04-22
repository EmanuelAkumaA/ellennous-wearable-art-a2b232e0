import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/lib/clientTelemetry", () => ({
  trackClientEvent: vi.fn(() => Promise.resolve()),
}));

import { ResponsivePicture } from "./responsive-picture";
import { __setWebpSupportForTests } from "@/lib/webpSupport";
import { trackClientEvent } from "@/lib/clientTelemetry";
import type { OptimizedVariant } from "@/lib/imageSnippet";

const SIZES = "(max-width:640px) 480px, (max-width:1024px) 1024px, 1600px";

const makeVariant = (
  overrides: Partial<OptimizedVariant> & { width: number; url: string },
): OptimizedVariant => ({
  format: "webp",
  path: `path/${overrides.url}`,
  size_bytes: 10000,
  ...overrides,
});

beforeEach(() => {
  // Default: assume WebP is supported so most assertions reflect the modern path.
  __setWebpSupportForTests(true);
  (trackClientEvent as unknown as ReturnType<typeof vi.fn>).mockClear();
});

describe("ResponsivePicture", () => {
  it("renders srcset with mobile/tablet/desktop ordered by width when device_label exists", () => {
    const variants: OptimizedVariant[] = [
      makeVariant({ width: 1600, url: "https://cdn/desktop.webp", device_label: "desktop" }),
      makeVariant({ width: 480, url: "https://cdn/mobile.webp", device_label: "mobile" }),
      makeVariant({ width: 1024, url: "https://cdn/tablet.webp", device_label: "tablet" }),
    ];

    render(
      <ResponsivePicture
        src="https://cdn/original.jpg"
        variants={variants}
        alt="cover"
        sizes={SIZES}
      />,
    );

    const img = screen.getByAltText("cover") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBe(
      "https://cdn/mobile.webp 480w, https://cdn/tablet.webp 1024w, https://cdn/desktop.webp 1600w",
    );
    expect(img.getAttribute("src")).toBe("https://cdn/desktop.webp");
    expect(img.getAttribute("sizes")).toBe(SIZES);
  });

  it("handles partial device_label (mobile + desktop) without breaking", () => {
    const variants: OptimizedVariant[] = [
      makeVariant({ width: 480, url: "https://cdn/m.webp", device_label: "mobile" }),
      makeVariant({ width: 1600, url: "https://cdn/d.webp", device_label: "desktop" }),
    ];

    render(
      <ResponsivePicture src="https://cdn/o.jpg" variants={variants} alt="x" sizes={SIZES} />,
    );

    const img = screen.getByAltText("x") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBe(
      "https://cdn/m.webp 480w, https://cdn/d.webp 1600w",
    );
    expect(img.getAttribute("src")).toBe("https://cdn/d.webp");
  });

  it("falls back to legacy WebP variants ordered by width when device_label is missing", () => {
    const variants: OptimizedVariant[] = [
      makeVariant({ width: 1200, url: "https://cdn/1200.webp" }),
      makeVariant({ width: 400, url: "https://cdn/400.webp" }),
      makeVariant({ width: 1600, url: "https://cdn/1600.webp" }),
      makeVariant({ width: 800, url: "https://cdn/800.webp" }),
    ];

    render(
      <ResponsivePicture src="https://cdn/o.jpg" variants={variants} alt="legacy" sizes={SIZES} />,
    );

    const img = screen.getByAltText("legacy") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBe(
      "https://cdn/400.webp 400w, https://cdn/800.webp 800w, https://cdn/1200.webp 1200w, https://cdn/1600.webp 1600w",
    );
    expect(img.getAttribute("src")).toBe("https://cdn/1600.webp");
  });

  it("falls back to largest JPEG when no WebP variants exist", () => {
    const variants: OptimizedVariant[] = [
      { format: "jpeg", width: 800, url: "https://cdn/800.jpg", path: "p/800.jpg", size_bytes: 1 },
      { format: "jpeg", width: 1600, url: "https://cdn/1600.jpg", path: "p/1600.jpg", size_bytes: 1 },
    ];

    render(
      <ResponsivePicture src="https://cdn/o.jpg" variants={variants} alt="jpg" sizes={SIZES} />,
    );

    const img = screen.getByAltText("jpg") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBeNull();
    expect(img.getAttribute("src")).toBe("https://cdn/1600.jpg");
  });

  it("renders plain <img> with passed src when variants are null/empty", () => {
    const { rerender } = render(
      <ResponsivePicture src="https://cdn/raw.jpg" variants={null} alt="raw" sizes={SIZES} />,
    );
    let img = screen.getByAltText("raw") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBeNull();
    expect(img.getAttribute("src")).toBe("https://cdn/raw.jpg");

    rerender(
      <ResponsivePicture src="https://cdn/raw.jpg" variants={[]} alt="raw" sizes={SIZES} />,
    );
    img = screen.getByAltText("raw") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBeNull();
    expect(img.getAttribute("src")).toBe("https://cdn/raw.jpg");
  });

  it("propagates loading, fetchPriority, alt, className and onClick", () => {
    const onClick = vi.fn();
    const variants: OptimizedVariant[] = [
      makeVariant({ width: 1600, url: "https://cdn/d.webp", device_label: "desktop" }),
    ];

    render(
      <ResponsivePicture
        src="https://cdn/o.jpg"
        variants={variants}
        alt="props"
        sizes={SIZES}
        loading="eager"
        fetchPriority="high"
        decoding="sync"
        className="rounded-lg"
        width={1600}
        height={900}
        onClick={onClick}
      />,
    );

    const img = screen.getByAltText("props") as HTMLImageElement;
    expect(img.getAttribute("loading")).toBe("eager");
    // React maps fetchPriority -> fetchpriority attribute (lowercase).
    expect(img.getAttribute("fetchpriority")).toBe("high");
    expect(img.getAttribute("decoding")).toBe("sync");
    expect(img.className).toBe("rounded-lg");
    expect(img.getAttribute("width")).toBe("1600");
    expect(img.getAttribute("height")).toBe("900");

    fireEvent.click(img);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("falls back to original src when WebP is unsupported", () => {
    __setWebpSupportForTests(false);
    const variants: OptimizedVariant[] = [
      makeVariant({ width: 1600, url: "https://cdn/d.webp", device_label: "desktop" }),
      makeVariant({ width: 480, url: "https://cdn/m.webp", device_label: "mobile" }),
    ];

    render(
      <ResponsivePicture
        src="https://cdn/original.jpg"
        variants={variants}
        alt="nowebp"
        sizes={SIZES}
      />,
    );

    const img = screen.getByAltText("nowebp") as HTMLImageElement;
    expect(img.getAttribute("srcset")).toBeNull();
    expect(img.getAttribute("src")).toBe("https://cdn/original.jpg");
  });
});
