"use client";

import { useState, type ReactNode } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { place, placementsOf, POOL } from "@/lib/submissions/match";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

const NEXT_KEYS = ["ArrowDown", "ArrowRight"];
const PREVIOUS_KEYS = ["ArrowUp", "ArrowLeft"];

/** From the keyboard, each arrow press moves the dragged item to the next (or previous) zone, top to bottom. */
const zoneKeyboardCoordinates: KeyboardCoordinateGetter = (event, { context: { collisionRect, droppableRects, droppableContainers, over } }) => {
  const forward = NEXT_KEYS.includes(event.code);
  if (!forward && !PREVIOUS_KEYS.includes(event.code)) return undefined;
  event.preventDefault();
  if (!collisionRect) return undefined;
  const zones = droppableContainers
    .getEnabled()
    .flatMap((c) => {
      const rect = droppableRects.get(c.id);
      return rect ? [{ id: c.id, rect }] : [];
    })
    .sort((a, b) => a.rect.top - b.rect.top);
  if (zones.length === 0) return undefined;
  const at = zones.findIndex((z) => z.id === (over?.id ?? POOL));
  const next = zones[Math.max(0, Math.min(zones.length - 1, at + (forward ? 1 : -1)))].rect;
  return {
    x: next.left + next.width / 2 - collisionRect.width / 2,
    y: next.top + next.height / 2 - collisionRect.height / 2,
  };
};

function ItemRow({
  item,
  categories,
  current,
  disabled,
  onChoose,
}: {
  item: Option;
  categories: Option[];
  current: string | undefined;
  disabled?: boolean;
  onChoose: (category: string) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, isDragging } = useDraggable({ id: item.id, disabled });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      data-testid="match-item"
      data-item={item.id}
      className={cn(
        "bg-card grid gap-2 rounded-lg border py-1.5 pr-1.5 pl-1 sm:flex sm:items-center",
        isDragging && "ring-ring/50 relative z-10 shadow-md ring-[3px]",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {/* The handle is the only drag target, so a finger can still scroll the page from anywhere else on the row. */}
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          disabled={disabled}
          aria-label={`Drag ${item.label}`}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex size-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md outline-none focus-visible:ring-[3px] active:cursor-grabbing disabled:opacity-50"
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
        <span className="min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere]">{item.label}</span>
      </div>
      <Select value={current ?? POOL} onValueChange={onChoose} disabled={disabled}>
        <SelectTrigger size="sm" className="w-full sm:w-56 [&>span]:truncate" aria-label={`Category for ${item.label}`} data-testid="match-select">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={POOL}>Not placed yet</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id} className="whitespace-normal">
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </li>
  );
}

function Zone({ id, title, empty, children, count }: { id: string; title: ReactNode; empty: string; children: ReactNode; count: number }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section
      ref={setNodeRef}
      aria-label={typeof title === "string" ? title : undefined}
      data-testid={id === POOL ? "match-pool" : "match-category"}
      data-category={id === POOL ? undefined : id}
      className={cn(
        "grid gap-2 rounded-xl border border-dashed p-3 transition-colors motion-reduce:transition-none",
        isOver ? "border-primary bg-primary/5" : "bg-muted/30",
      )}
    >
      <h4 className="text-sm font-medium leading-snug">{title}</h4>
      {count === 0 ? <p className="text-muted-foreground text-meta">{empty}</p> : <ul className="grid gap-2">{children}</ul>}
    </section>
  );
}

/**
 * Put each item on its category. Two ways to move one: drag its handle onto a category (mouse, touch, or Space and the
 * arrow keys from the keyboard), or pick the category in the item's menu, which works for anyone who can't or doesn't
 * want to drag. When each category takes one item, putting an item on a taken category sends the one there back to
 * "Items to place". Controlled: `value` is the list of "item=category" pairs placed so far.
 */
export function MatchField({
  questionId,
  items,
  categories,
  onePerCategory,
  value,
  onChange,
  disabled,
}: {
  questionId: string;
  items: Option[];
  categories: Option[];
  onePerCategory: boolean;
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  disabled?: boolean;
}) {
  const placements = placementsOf(items, categories, value);
  const [status, setStatus] = useState("");
  const itemLabel = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  const zoneLabel = (id: string) => (id === POOL ? "Items to place" : (categories.find((c) => c.id === id)?.label ?? id));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // A short press-and-hold on the handle starts a drag; a quick swipe still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: zoneKeyboardCoordinates }),
  );
  // The pointer's position decides the zone; from the keyboard (no pointer) the zone the item was moved to does.
  const collision: CollisionDetection = (args) => {
    if (!args.pointerCoordinates) return closestCenter(args);
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : rectIntersection(args);
  };

  function choose(item: string, category: string) {
    if ((placements.get(item) ?? POOL) === category) return;
    const { pairs, displaced } = place(items, placements, item, category, onePerCategory);
    onChange(pairs);
    setStatus(
      `${itemLabel(item)} ${category === POOL ? "moved back to Items to place" : `placed on ${zoneLabel(category)}`}.` +
        (displaced ? ` ${itemLabel(displaced)} moved back to Items to place.` : ""),
    );
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (over) choose(String(active.id), String(over.id));
  }

  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${itemLabel(String(active.id))}.`,
    onDragOver: ({ active, over }) => (over ? `${itemLabel(String(active.id))} is over ${zoneLabel(String(over.id))}.` : undefined),
    onDragEnd: ({ active, over }) => (over ? `${itemLabel(String(active.id))} dropped on ${zoneLabel(String(over.id))}.` : `${itemLabel(String(active.id))} dropped.`),
    onDragCancel: ({ active }) => `Move cancelled. ${itemLabel(String(active.id))} is back where it was.`,
  };

  const rows = (inZone: string) =>
    items
      .filter((i) => (placements.get(i.id) ?? POOL) === inZone)
      .map((i) => (
        <ItemRow key={i.id} item={i} categories={categories} current={placements.get(i.id)} disabled={disabled} onChoose={(c) => choose(i.id, c)} />
      ));
  const unplaced = items.filter((i) => !placements.has(i.id)).length;

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">
        Drag each item onto its category, or choose the category in the item&apos;s menu.
        {onePerCategory ? " Each category takes one item." : " A category can take more than one item."} With a keyboard, focus
        an item&apos;s handle and press Space, then the arrow keys.
      </p>
      <DndContext
        id={`match-${questionId}`}
        sensors={sensors}
        collisionDetection={collision}
        onDragEnd={onDragEnd}
        accessibility={{
          announcements,
          screenReaderInstructions: { draggable: "Press Space to pick up, the arrow keys to move from category to category, Space to drop, Escape to cancel." },
        }}
      >
        <Zone id={POOL} title="Items to place" empty="All items are placed." count={unplaced}>
          {rows(POOL)}
        </Zone>
        <div className="grid gap-3">
          {categories.map((c) => (
            <Zone key={c.id} id={c.id} title={c.label} empty="Drop an item here" count={rows(c.id).length}>
              {rows(c.id)}
            </Zone>
          ))}
        </div>
      </DndContext>
      <p role="status" className="sr-only" data-testid="match-status">
        {status}
      </p>
    </div>
  );
}
