import type { Ref } from "vue";

// Pixels a mouse has to travel before a press becomes a drag. Below this it
// stays a click, so a slightly shaky click on a link still navigates.
const DRAG_THRESHOLD = 5;

/**
 * Makes a horizontally overflowing element draggable and reports which ends
 * still have hidden content.
 *
 * Touch already scrolls an `overflow-x-auto` element natively, so this only
 * adds mouse dragging (a narrow desktop window has no swipe and usually no
 * horizontal wheel). `canScrollStart`/`canScrollEnd` drive edge fades that
 * hint at the hidden items, since the scrollbar itself is hidden.
 */
export function useDragScroll(el: Ref<HTMLElement | null>) {
  const canScrollStart = ref(false);
  const canScrollEnd = ref(false);

  function update() {
    const node = el.value;
    if (!node) return;
    // 1px slack: scrollLeft is fractional on high-DPI screens and can stop
    // just short of the true end.
    canScrollStart.value = node.scrollLeft > 1;
    canScrollEnd.value =
      node.scrollLeft + node.clientWidth < node.scrollWidth - 1;
  }

  let pointerId: number | null = null;
  let startX = 0;
  let startScroll = 0;
  let dragged = false;

  function onPointerDown(event: PointerEvent) {
    const node = el.value;
    if (!node || event.pointerType !== "mouse" || event.button !== 0) return;
    if (node.scrollWidth <= node.clientWidth) return;
    pointerId = event.pointerId;
    startX = event.clientX;
    startScroll = node.scrollLeft;
    dragged = false;
  }

  function onPointerMove(event: PointerEvent) {
    const node = el.value;
    if (!node || event.pointerId !== pointerId) return;
    const dx = event.clientX - startX;
    if (!dragged && Math.abs(dx) < DRAG_THRESHOLD) return;
    if (!dragged) {
      dragged = true;
      // Capture only once it is a real drag: capturing on pointerdown would
      // retarget the click to the list and break plain link clicks.
      node.setPointerCapture(event.pointerId);
    }
    node.scrollLeft = startScroll - dx;
  }

  function onPointerUp(event: PointerEvent) {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
  }

  // A drag that ends over a link would otherwise also navigate to it.
  function onClickCapture(event: MouseEvent) {
    if (!dragged) return;
    dragged = false;
    event.preventDefault();
    event.stopPropagation();
  }

  // Links and images are natively draggable; that HTML5 drag would swallow
  // the pointer events this relies on.
  function onDragStart(event: DragEvent) {
    event.preventDefault();
  }

  /** Scrolls `child` fully into view within the element, horizontally only. */
  function reveal(child: HTMLElement, smooth = true) {
    const node = el.value;
    if (!node) return;
    // Rects rather than offsetLeft, which depends on which ancestor happens
    // to be positioned.
    const left =
      child.getBoundingClientRect().left -
      node.getBoundingClientRect().left +
      node.scrollLeft;
    const right = left + child.offsetWidth;
    let target: number | null = null;
    if (left < node.scrollLeft) target = left;
    else if (right > node.scrollLeft + node.clientWidth)
      target = right - node.clientWidth;
    if (target === null) return;
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    node.scrollTo({
      left: target,
      behavior: smooth && !reduceMotion ? "smooth" : "auto",
    });
  }

  let observer: ResizeObserver | null = null;

  onMounted(() => {
    const node = el.value;
    if (!node) return;
    node.addEventListener("scroll", update, { passive: true });
    node.addEventListener("pointerdown", onPointerDown);
    node.addEventListener("pointermove", onPointerMove);
    node.addEventListener("pointerup", onPointerUp);
    node.addEventListener("pointercancel", onPointerUp);
    node.addEventListener("click", onClickCapture, true);
    node.addEventListener("dragstart", onDragStart);
    // Crossing the sm breakpoint switches overflow on/off without a scroll
    // event, so re-measure on resize too.
    observer = new ResizeObserver(update);
    observer.observe(node);
    update();
  });

  onBeforeUnmount(() => {
    const node = el.value;
    observer?.disconnect();
    if (!node) return;
    node.removeEventListener("scroll", update);
    node.removeEventListener("pointerdown", onPointerDown);
    node.removeEventListener("pointermove", onPointerMove);
    node.removeEventListener("pointerup", onPointerUp);
    node.removeEventListener("pointercancel", onPointerUp);
    node.removeEventListener("click", onClickCapture, true);
    node.removeEventListener("dragstart", onDragStart);
  });

  return { canScrollStart, canScrollEnd, reveal };
}
