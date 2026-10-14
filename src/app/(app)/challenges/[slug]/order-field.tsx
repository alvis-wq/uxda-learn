"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Item = { id: string; label: string };

/** The items in the order to show: the learner's arrangement when it is a complete one, else the starting order. */
export function arrangeItems(items: Item[], value: string[] | undefined): Item[] {
  if (!value || value.length !== items.length) return items;
  const byId = new Map(items.map((i) => [i.id, i]));
  const arranged = value.map((id) => byId.get(id));
  return arranged.every(Boolean) && new Set(value).size === items.length ? (arranged as Item[]) : items;
}

type Direction = "up" | "down";

function Row({
  item,
  position,
  total,
  disabled,
  onMove,
  registerButton,
}: {
  item: Item;
  position: number;
  total: number;
  disabled?: boolean;
  onMove: (direction: Direction) => void;
  registerButton: (direction: Direction, el: HTMLButtonElement | null) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });
  return (
    <li
      ref={setNodeRef}
      // Vertical only: the list is a single column.
      style={{ transform: CSS.Translate.toString(transform && { ...transform, x: 0 }), transition }}
      data-testid="order-item"
      className={cn(
        "bg-card flex items-center gap-2 rounded-lg border py-1.5 pr-1.5 pl-1",
        isDragging && "ring-ring/50 relative z-10 shadow-md ring-[3px]",
      )}
    >
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
      <span className="text-muted-foreground w-5 shrink-0 text-sm tabular-nums" aria-hidden>
        {position}.
      </span>
      <span className="min-w-0 flex-1 text-sm leading-snug [overflow-wrap:anywhere]">{item.label}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || position === 1}
        onClick={() => onMove("up")}
        ref={(el: HTMLButtonElement | null) => registerButton("up", el)}
        aria-label={`Move ${item.label} up`}
      >
        <ChevronUp aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled || position === total}
        onClick={() => onMove("down")}
        ref={(el: HTMLButtonElement | null) => registerButton("down", el)}
        aria-label={`Move ${item.label} down`}
      >
        <ChevronDown aria-hidden />
      </Button>
    </li>
  );
}

/**
 * Put items in the right order. Three ways to move one: drag its handle (mouse or touch), focus the handle and use
 * Space + the arrow keys, or press the Move up / Move down buttons on the item, which work for anyone who can't or
 * doesn't want to drag. Controlled: `value` is the complete arrangement once the learner has changed anything,
 * `undefined` while the list still shows its (shuffled) starting order.
 */
export function OrderField({
  questionId,
  items,
  value,
  onChange,
  disabled,
  describedBy,
}: {
  questionId: string;
  items: Item[];
  value: string[] | undefined;
  onChange: (value: string[]) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const arranged = arrangeItems(items, value);
  const ids = arranged.map((i) => i.id);
  const label = (id: string) => items.find((i) => i.id === id)?.label ?? id;
  const instructionsId = useId();
  const [status, setStatus] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    // A short press-and-hold on the handle starts a drag; a quick swipe still scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // After a button move, keep focus on the same item: on the button just used, or the other one if it is now disabled.
  const buttons = useRef(new Map<string, HTMLButtonElement>());
  const refocus = useRef<{ id: string; direction: Direction } | null>(null);
  useEffect(() => {
    const target = refocus.current;
    if (!target) return;
    refocus.current = null;
    const index = ids.indexOf(target.id);
    const preferred = buttons.current.get(`${target.id}:${target.direction}`);
    const other = buttons.current.get(`${target.id}:${target.direction === "up" ? "down" : "up"}`);
    const atEdge = target.direction === "up" ? index === 0 : index === ids.length - 1;
    (atEdge ? other : preferred)?.focus();
  });

  function announce(id: string, to: number) {
    setStatus(`${label(id)} moved to position ${to + 1} of ${ids.length}.`);
  }

  function move(id: string, direction: Direction) {
    const from = ids.indexOf(id);
    const to = direction === "up" ? from - 1 : from + 1;
    if (to < 0 || to >= ids.length) return;
    refocus.current = { id, direction };
    onChange(arrayMove(ids, from, to));
    announce(id, to);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    onChange(arrayMove(ids, from, to)); // dnd-kit announces the drop itself (see `announcements`)
  }

  // dnd-kit's own announcements name items by id; ours use the labels and positions.
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${label(String(active.id))}, position ${ids.indexOf(String(active.id)) + 1} of ${ids.length}.`,
    onDragOver: ({ active, over }) =>
      over ? `${label(String(active.id))} is over position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.` : undefined,
    onDragEnd: ({ active, over }) =>
      over ? `${label(String(active.id))} dropped at position ${ids.indexOf(String(over.id)) + 1} of ${ids.length}.` : `${label(String(active.id))} dropped.`,
    onDragCancel: ({ active }) => `Move cancelled. ${label(String(active.id))} is back at position ${ids.indexOf(String(active.id)) + 1}.`,
  };

  return (
    <div className="grid gap-2">
      <p id={instructionsId} className="text-muted-foreground text-sm">
        Drag the items into the right order. Or use the arrow buttons on each item. With a keyboard, focus the handle and
        press Space, then the arrow keys.
      </p>
      <DndContext
        id={`order-${questionId}`}
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
        accessibility={{ announcements, screenReaderInstructions: { draggable: "Press Space to pick up, the up and down arrow keys to move, Space to drop, Escape to cancel." } }}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
          <ol aria-describedby={[instructionsId, describedBy].filter(Boolean).join(" ")} className="grid gap-2" data-testid="order-list">
            {arranged.map((item, i) => (
              <Row
                key={item.id}
                item={item}
                position={i + 1}
                total={arranged.length}
                disabled={disabled}
                onMove={(direction) => move(item.id, direction)}
                registerButton={(direction, el) => {
                  if (el) buttons.current.set(`${item.id}:${direction}`, el);
                  else buttons.current.delete(`${item.id}:${direction}`);
                }}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
      <p role="status" className="sr-only" data-testid="order-status">
        {status}
      </p>
    </div>
  );
}
