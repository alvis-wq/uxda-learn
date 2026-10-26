"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, Loader2, Sparkles, Upload } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createResource, previewLink, updateResource, uploadAcademyImage, type ResourceInput } from "@/lib/academy/manage-actions";
import { BOOK_CATEGORIES, BOOK_CATEGORY_LABEL, type BookCategory, type ResourceKind } from "@/lib/academy/resources";

type Existing = {
  id: string;
  title: string;
  url: string | null;
  description: string | null;
  author: string | null;
  category: string | null;
  blogId: string | null;
  imageUrl: string | null;
};

/** The picture as the form holds it: unchanged, removed, uploaded (a bucket path) or found on the page (a URL). */
type Picture = { type: "keep" } | { type: "none" } | { type: "path"; path: string; preview: string } | { type: "remote"; url: string };

const NO_BLOG = "__none";

/**
 * Add or edit an Academy resource. Paste the link and press "Fill in from link": title, description and picture
 * (blog posts, podcasts) or cover, author and blurb (books, via Open Library) are filled in; everything stays
 * editable. New resources are saved as drafts and open on their edit page, where the quiz is added.
 */
export function ResourceForm({ base, kind, blogs, existing }: { base: string; kind: ResourceKind; blogs: { id: string; title: string }[]; existing?: Existing }) {
  const router = useRouter();
  const [url, setUrl] = useState(existing?.url ?? "");
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [author, setAuthor] = useState(existing?.author ?? "");
  const [category, setCategory] = useState<BookCategory>((existing?.category as BookCategory) ?? "academy");
  const [blogId, setBlogId] = useState(existing?.blogId ?? NO_BLOG);
  const [picture, setPicture] = useState<Picture>({ type: "keep" });
  const [error, setError] = useState<string | null>(null);
  const [previewing, startPreview] = useTransition();
  const [uploading, startUpload] = useTransition();
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const pictureSrc =
    picture.type === "keep" ? existing?.imageUrl ?? null : picture.type === "none" ? null : picture.type === "path" ? picture.preview : picture.url;
  const busy = previewing || uploading || saving;

  function fillFromLink() {
    setError(null);
    startPreview(async () => {
      const res = await previewLink(kind, url.trim(), kind === "book" ? title : undefined);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const p = res.data;
      if (p.title) setTitle(p.title);
      if (p.description) setDescription(p.description.slice(0, 1200));
      if (p.author) setAuthor(p.author);
      if (p.imageUrl) setPicture({ type: "remote", url: p.imageUrl });
      toast.success(p.description ? "Filled in from the link. Check it over." : "Filled in what the link had. There was no description.");
    });
  }

  function upload(file: File) {
    setError(null);
    startUpload(async () => {
      const form = new FormData();
      form.set("file", file);
      const res = await uploadAcademyImage(form);
      if (!res.ok) setError(res.error);
      else setPicture({ type: "path", path: res.data.path, preview: URL.createObjectURL(file) });
    });
  }

  function save() {
    setError(null);
    const input: ResourceInput = {
      kind,
      title,
      url: url.trim(),
      description,
      author,
      category: kind === "book" ? category : null,
      blogId: kind === "podcast" && blogId !== NO_BLOG ? blogId : null,
      image: picture.type === "path" ? { type: "path", path: picture.path } : picture.type === "remote" ? { type: "remote", url: picture.url } : picture,
    };
    startSave(async () => {
      if (existing) {
        const res = await updateResource(existing.id, input);
        if (!res.ok) setError(res.error);
        else {
          toast.success("Saved.");
          setPicture({ type: "keep" });
          router.refresh();
        }
      } else {
        const res = await createResource(input);
        if (!res.ok) setError(res.error);
        else {
          toast.success("Saved as a draft. Now add the quiz.");
          router.push(`${base}/${res.data.id}`);
        }
      }
    });
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      data-testid="resource-form"
    >
      <div className="grid gap-2">
        <Label htmlFor="res-url">{kind === "book" ? "Link (optional: Amazon, Google Drive…)" : "Link"}</Label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input id="res-url" type="url" inputMode="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} required={kind !== "book"} />
          <Button type="button" variant="outline" onClick={fillFromLink} disabled={busy || (!url.trim() && !(kind === "book" && title.trim()))}>
            {previewing ? <Loader2 className="animate-spin" aria-hidden /> : <Sparkles aria-hidden />}
            Fill in from {kind === "book" && !url.trim() ? "title" : "link"}
          </Button>
        </div>
        {kind === "book" && <p className="text-muted-foreground text-meta">No link? Type the title (and author) below and fill in from the title.</p>}
      </div>

      {kind === "podcast" && (
        <div className="grid gap-2">
          <Label htmlFor="res-blog">About which blog post?</Label>
          <Select value={blogId} onValueChange={setBlogId}>
            <SelectTrigger id="res-blog" className="w-full">
              <SelectValue placeholder="Choose a blog post" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_BLOG}>Not about a blog post</SelectItem>
              {blogs.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-meta">The episode shows next to its post. Posts that already have an episode aren&apos;t listed.</p>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="res-title">Title</Label>
        <Input id="res-title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={300} />
      </div>

      {kind === "book" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="res-author">Author</Label>
            <Input id="res-author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="res-category">List</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as BookCategory)}>
              <SelectTrigger id="res-category" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOOK_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {BOOK_CATEGORY_LABEL[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="grid gap-2">
        <Label htmlFor="res-description">Short description</Label>
        <Textarea id="res-description" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1200} />
      </div>

      <div className="grid gap-2">
        <span className="text-sm font-medium" id="res-picture-label">
          {kind === "book" ? "Cover" : "Thumbnail"}
        </span>
        <div className="flex items-center gap-4" aria-labelledby="res-picture-label" role="group">
          <div className="bg-muted grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-md" data-testid="picture-preview">
            {pictureSrc ? (
              // eslint-disable-next-line @next/next/no-img-element -- a local object URL or a remote preview, never optimised
              <img src={pictureSrc} alt="" className="size-full object-cover" />
            ) : (
              <ImageOff className="text-muted-foreground size-6" aria-hidden />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(f);
                e.target.value = "";
              }}
            />
            <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {uploading ? <Loader2 className="animate-spin" aria-hidden /> : <Upload aria-hidden />}
              Upload
            </Button>
            {pictureSrc && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setPicture({ type: "none" })} disabled={busy}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <p className="text-muted-foreground text-meta">PNG, JPEG or WebP, up to 4 MB. A picture found on the page is copied when you save.</p>
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div>
        <Button type="submit" disabled={busy || !title.trim()}>
          {saving && <Loader2 className="animate-spin" aria-hidden />}
          {existing ? "Save details" : "Save as draft"}
        </Button>
      </div>
    </form>
  );
}
