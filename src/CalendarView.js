import { View } from "@croquet/croquet";
import SelectionArea from "@viselect/vanilla";
import { render } from "@itsjavi/jsx-runtime/src/jsx-runtime/index";
import {
  addHours,
  addDays,
  startOfToday,
  intlFormat,
  isWeekend,
  addMinutes,
} from "date-fns";
import { element, isMobile, range, target } from "./utils";
import { config } from "./config";
import createDotElements from "./components/Dots";

const selectableOptions = {
  selectables: ["section.calendar .time-slot"],
  boundaries: ["section.calendar"],
  features: {
    touch: true,
    range: true,
    singleTap: {
      allow: true,
      intersect: "native",
    },
  },
};

// TODO: constants should be in Q
const dateFormat = {
  weekday: "long",
  // month: "short",
  day: "numeric",
};

export default class CalendarView extends View {
  constructor(model, identity, configuration, pills) {
    super(model);
    this.model = model;
    this.identity = identity;
    this.configuration = configuration;
    this.pills = pills;

    this.init();

    this.subscribeToEvents();
  }

  init() {
    this.selection = new SelectionArea(selectableOptions)
      .on("beforestart", this.beforeSelectionStarts.bind(this))
      .on("move", this.whileSelecting.bind(this))
      .on("stop", this.onSelectionEnd.bind(this));
  }

  subscribeToEvents() {
    this.subscribe("identity", "established", this.hydrate);

    this.subscribe(
      "calendar",
      "selected-slots-updated",
      this.displaySlotsState
    );

    this.subscribe("settings", "update-days-range", this.render);
    this.subscribe("settings", "update-time-range", this.render);
    this.subscribe("settings", "update-allow-weekends", this.render);
    this.subscribe("settings", "update-half-hours", this.render);

    this.subscribe(
      "calendar",
      "user-pills-selection",
      this.highlightSelectionForUsers
    );

    this.initColumnTitleSelection();
  }

  hydrate() {
    this.render({
      lower: this.configuration.daysRange[0],
      upper: this.configuration.daysRange[1],
    });
  }

  initColumnTitleSelection() {
    const targetNode = element(".calendar-columns");

    const config = { attributes: false, childList: true, subtree: false };

    const selectAll = (slot) => {
      slot.classList.add("selected");
    };

    const deselectAll = (slot) => {
      slot.classList.remove("selected");
    };

    const bindToggleOnClick = (title) => {
      title.onclick = () => {
        const slots = title.nextSibling.childNodes;

        const isAnySlotSelected = Array.from(slots).some((slot) =>
          slot.classList.contains("selected")
        );

        const previousSelection = this.selection
          .getSelection()
          .map((slot) => slot.dataset.slot);

        const selection = Array.from(slots).map((slot) => slot.dataset.slot);

        if (isAnySlotSelected) {
          slots.forEach(deselectAll);
          this.publishSelection(
            previousSelection.filter((slot) => !selection.includes(slot))
          );
        } else {
          slots.forEach(selectAll);
          this.publishSelection([...previousSelection, ...selection]);
        }
      };
    };

    const whenColumnsRender = (mutationsList) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          const columnTitles = document.querySelectorAll(".day .title.cell");

          columnTitles.forEach(bindToggleOnClick);
        }
      }
    };

    const observer = new MutationObserver(whenColumnsRender);

    observer.observe(targetNode, config);
  }

  generateListOfDates(date, length) {
    if (length === 0) return [date];

    const nextDay = addDays(date, 1);

    const allowWeekends = this.configuration.allowWeekends;

    if (!allowWeekends && isWeekend(date))
      return [...this.generateListOfDates(nextDay, length)];

    return [date, ...this.generateListOfDates(nextDay, --length)];
  }

  render() {
    const [startDay, endDay] = this.configuration.daysRange;
    const [startTime, endTime] = this.configuration.timeRange;

    const today = new Date(startOfToday());
    const firstDay = addDays(today, startDay);

    const daysRange = this.generateListOfDates(firstDay, endDay - startDay);

    const columns = (
      <>
        {daysRange.map((day) => {
          const formattedDate = intlFormat(day, dateFormat, {
            locale: config.locale,
          });

          const timeRange = range(startTime, endTime);
          const halfHourIntervals = this.configuration.halfHourIntervals;

          return (
            <div className="day">
              <div className="title cell">{formattedDate}</div>
              <div className="day-schedule">
                {timeRange.map((hours, i) => {
                  const timestamp = addHours(day, hours).toISOString();

                  let plainHour = this.timeSlot(timestamp, hours);

                  if (!halfHourIntervals) return plainHour;

                  const withMinutes = addMinutes(
                    new Date(timestamp),
                    30
                  ).toISOString();

                  return (
                    <div className="half-hour-intervals">
                      {plainHour}
                      {this.timeSlot(withMinutes, hours + ":30", "half-hour")}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </>
    );

    render(columns, target(".calendar-columns"));

    this.displaySlotsState();
  }

  timeSlot(timestamp, readableTime, className) {
    return (
      <div className={`time-slot cell ${className}`} data-slot={timestamp}>
        <div className="dots"></div>
        {readableTime + "hs"}
      </div>
    );
  }

  displaySlotsState() {
    const selfId = this.me();

    this.highlightSelectionForUsers({
      userId: selfId,
      selectedUsersIds: this.pills.pillsForUser(selfId),
    });

    this.displayVotes({ countedSlots: this.model.countedSlots() });
  }

  displayVotes({ countedSlots }) {
    const slotElement = Array.from(
      document.getElementsByClassName("time-slot")
    );

    slotElement.forEach((cell) => {
      this.addDotsToCalendarSlot(countedSlots, cell);
    });
  }

  beforeSelectionStarts() {
    if (!isMobile) return;

    let timeout = null;

    return ({ event }) => {
      // Check if user already tapped inside of a selection-area.
      if (timeout !== null) {
        // A second pointer-event occurred, ignore that one.
        clearTimeout(timeout);
        timeout = null;
      } else {
        // Wait 50ms in case the user uses two fingers to scroll.
        timeout = setTimeout(() => {
          // OK User used only one finger, we can safely initiate a selection and reset the timer.
          this.selection.trigger(event);
          timeout = null;
        }, 50);
      }

      // Never start automatically.
      return false;
    };
  }

  whileSelecting({
    store: {
      changed: { added, removed },
    },
  }) {
    for (const el of added) {
      el.classList.add("selected");
    }

    for (const el of removed) {
      el.classList.remove("selected");
    }
  }

  onSelectionEnd({ store }) {
    const previousSelection = this.model.userSelection(this.me());
    const added = store.changed.added.map((added) => added.dataset.slot);
    const selected = store.selected.map((selected) => selected.dataset.slot);
    const removed = store.changed.removed.map(
      (removed) => removed.dataset.slot
    );

    const selection = previousSelection
      .concat(selected)
      .concat(added)
      .filter((slot) => !removed.includes(slot));

    this.publishSelection(Array.from(new Set(selection)));
  }

  publishSelection(selection) {
    this.publish("calendar", "selection", {
      userId: this.me(),
      slots: selection,
    });
  }

  highlightSelectionForUsers({ userId, selectedUsersIds }) {
    const selfId = this.me();
    if (userId !== selfId) return;

    this.clearHighlights();

    if (selectedUsersIds.length === 1) {
      this.highlightSelectionForUser(selectedUsersIds.pop());

      return;
    }

    const commonSlots = this.model.usersCommonSlots(selectedUsersIds);
    if (commonSlots.length > 0) {
      this.highlightSlots(commonSlots, true);
    }
  }

  clearHighlights() {
    document.querySelectorAll(".calendar .selected").forEach((slot) => {
      slot.classList.remove("selected", "match");
    });

    this.selection.clearSelection();
  }

  highlightSlots(slots, isAMatch = false) {
    slots.forEach((selection) => {
      const slot = element(`[data-slot="${selection}"]`);
      if (!slot) return;

      slot.classList.add("selected");

      if (isAMatch) slot.classList.add("match");
    });
  }

  highlightSelectionForUser(userId) {
    const { selectedSlotsByUser } = this.model;

    const slotSelection = selectedSlotsByUser.has(userId)
      ? selectedSlotsByUser.get(userId)
      : [];

    this.highlightSlots(slotSelection);

    this.selection.select(".calendar .selected");
  }

  addDotsToCalendarSlot(countedSlots, timeSlot) {
    const votes = countedSlots.get(timeSlot.dataset.slot) || 0;

    const dotsElement = timeSlot.querySelector(".dots");

    if (votes === 0) {
      render(<></>, dotsElement);
      return;
    }

    const usersList = this.model
      .usersWhoSelectedSlot(timeSlot.dataset.slot)
      .map((userId) => this.identity.name(userId))
      .join(", ");

    const dots = createDotElements(votes, usersList);

    render(<>{dots}</>, dotsElement);
  }

  me() {
    return this.identity.selfId(this.viewId);
  }
}
